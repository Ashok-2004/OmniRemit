using AuthService.Application.DTOs;
using AuthService.Domain.Entities;
using AuthService.Domain.Enums;
using AuthService.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Application.Services;

/// <summary>
/// Read side (the Role editor's per-feature Features/Capabilities matrix, permission gating) plus
/// the internal write side that the Module Registry service calls to keep RemoteApp-sourced features
/// — and their own dynamically-declared capabilities — in sync. See
/// Controllers/InternalController.cs for the API-key-gated HTTP surface over this.
/// </summary>
public class PermissionCatalogAppService(AuthDbContext db)
{
    public async Task<IReadOnlyList<PermissionFeatureDto>> GetCatalogAsync(bool activeOnly, CancellationToken ct = default)
    {
        var query = db.PermissionFeatures.AsNoTracking().Include(f => f.Capabilities).AsQueryable();
        if (activeOnly)
        {
            query = query.Where(f => f.IsActive);
        }

        var features = await query
            .OrderBy(f => f.SortOrder)
            .ThenBy(f => f.DisplayName)
            .ToListAsync(ct);

        return features.Select(ToDto).ToList();
    }

    /// <summary>Upserts a RemoteApp feature AND fully replaces its capability set (idempotent — same full-replace pattern used for RolePermissions on role save).</summary>
    public async Task UpsertRemoteAppFeatureAsync(string key, string displayName, int sortOrder, IReadOnlyList<UpsertCapabilityRequest> capabilities, CancellationToken ct = default)
    {
        var existing = await db.PermissionFeatures.Include(f => f.Capabilities).FirstOrDefaultAsync(f => f.Key == key, ct);
        var now = DateTimeOffset.UtcNow;

        if (existing is null)
        {
            existing = new PermissionFeature
            {
                Id = Guid.NewGuid(),
                Key = key,
                DisplayName = displayName,
                Source = PermissionFeatureSource.RemoteApp,
                IsActive = true,
                SortOrder = sortOrder,
                CreatedAt = now,
                UpdatedAt = now,
            };
            db.PermissionFeatures.Add(existing);
        }
        else
        {
            existing.DisplayName = displayName;
            existing.SortOrder = sortOrder;
            existing.IsActive = true;
            existing.UpdatedAt = now;
            db.PermissionFeatureCapabilities.RemoveRange(existing.Capabilities);
        }

        for (var i = 0; i < capabilities.Count; i++)
        {
            db.PermissionFeatureCapabilities.Add(new PermissionFeatureCapability
            {
                Id = Guid.NewGuid(),
                FeatureId = existing.Id,
                Key = capabilities[i].Key,
                DisplayName = capabilities[i].DisplayName,
                SortOrder = capabilities[i].SortOrder,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task DeactivateRemoteAppFeatureAsync(string key, CancellationToken ct = default)
    {
        var existing = await db.PermissionFeatures.FirstOrDefaultAsync(f => f.Key == key && f.Source == PermissionFeatureSource.RemoteApp, ct);
        if (existing is null)
        {
            return;
        }

        existing.IsActive = false;
        existing.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Full recovery resync: upserts every feature+capability-set in <paramref name="features"/> as active, deactivates any RemoteApp feature not present in the list.</summary>
    public async Task ResyncRemoteAppFeaturesAsync(IReadOnlyList<UpsertPermissionFeatureRequest> features, CancellationToken ct = default)
    {
        var incomingKeys = features.Select(f => f.Key).ToHashSet();

        var existingRemoteFeatures = await db.PermissionFeatures
            .Include(f => f.Capabilities)
            .Where(f => f.Source == PermissionFeatureSource.RemoteApp)
            .ToListAsync(ct);

        foreach (var incoming in features)
        {
            await UpsertRemoteAppFeatureAsync(incoming.Key, incoming.DisplayName, incoming.SortOrder, incoming.Capabilities, ct);
        }

        var now = DateTimeOffset.UtcNow;
        foreach (var existing in existingRemoteFeatures.Where(f => !incomingKeys.Contains(f.Key) && f.IsActive))
        {
            existing.IsActive = false;
            existing.UpdatedAt = now;
        }

        await db.SaveChangesAsync(ct);
    }

    private static PermissionFeatureDto ToDto(PermissionFeature f) => new(
        f.Id, f.Key, f.DisplayName, f.Source.ToString(), f.SortOrder,
        f.Capabilities.OrderBy(c => c.SortOrder).Select(c => new CapabilityDto(c.Key, c.DisplayName)).ToList());
}
