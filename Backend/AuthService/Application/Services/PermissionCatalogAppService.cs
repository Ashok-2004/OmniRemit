using AuthService.Application.DTOs;
using AuthService.Domain.Entities;
using AuthService.Domain.Enums;
using AuthService.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Application.Services;

/// <summary>
/// Read side (the Role editor's Features/Capabilities matrix, permission gating) plus the internal
/// write side that the Module Registry service calls to keep RemoteApp-sourced features in sync —
/// see Controllers/InternalController.cs for the API-key-gated HTTP surface over this.
/// </summary>
public class PermissionCatalogAppService(AuthDbContext db)
{
    public async Task<IReadOnlyList<PermissionFeatureDto>> GetCatalogAsync(bool activeOnly, CancellationToken ct = default)
    {
        var query = db.PermissionFeatures.AsNoTracking().AsQueryable();
        if (activeOnly)
        {
            query = query.Where(f => f.IsActive);
        }

        return await query
            .OrderBy(f => f.SortOrder)
            .ThenBy(f => f.DisplayName)
            .Select(f => new PermissionFeatureDto(f.Id, f.Key, f.DisplayName, f.Source.ToString(), f.SortOrder))
            .ToListAsync(ct);
    }

    public static IReadOnlyList<string> GetCapabilities() => Enum.GetNames<CapabilityType>();

    public async Task UpsertRemoteAppFeatureAsync(string key, string displayName, int sortOrder, CancellationToken ct = default)
    {
        var existing = await db.PermissionFeatures.FirstOrDefaultAsync(f => f.Key == key, ct);
        var now = DateTimeOffset.UtcNow;

        if (existing is null)
        {
            db.PermissionFeatures.Add(new PermissionFeature
            {
                Id = Guid.NewGuid(),
                Key = key,
                DisplayName = displayName,
                Source = PermissionFeatureSource.RemoteApp,
                IsActive = true,
                SortOrder = sortOrder,
                CreatedAt = now,
                UpdatedAt = now,
            });
        }
        else
        {
            existing.DisplayName = displayName;
            existing.SortOrder = sortOrder;
            existing.IsActive = true;
            existing.UpdatedAt = now;
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

    /// <summary>Full recovery resync: upserts every feature in <paramref name="features"/> as active, deactivates any RemoteApp feature not present in the list.</summary>
    public async Task ResyncRemoteAppFeaturesAsync(IReadOnlyList<UpsertPermissionFeatureRequest> features, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var incomingKeys = features.Select(f => f.Key).ToHashSet();

        var existingRemoteFeatures = await db.PermissionFeatures
            .Where(f => f.Source == PermissionFeatureSource.RemoteApp)
            .ToListAsync(ct);
        var existingByKey = existingRemoteFeatures.ToDictionary(f => f.Key);

        foreach (var incoming in features)
        {
            if (existingByKey.TryGetValue(incoming.Key, out var existing))
            {
                existing.DisplayName = incoming.DisplayName;
                existing.SortOrder = incoming.SortOrder;
                existing.IsActive = true;
                existing.UpdatedAt = now;
            }
            else
            {
                db.PermissionFeatures.Add(new PermissionFeature
                {
                    Id = Guid.NewGuid(),
                    Key = incoming.Key,
                    DisplayName = incoming.DisplayName,
                    Source = PermissionFeatureSource.RemoteApp,
                    IsActive = true,
                    SortOrder = incoming.SortOrder,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
            }
        }

        foreach (var existing in existingRemoteFeatures.Where(f => !incomingKeys.Contains(f.Key) && f.IsActive))
        {
            existing.IsActive = false;
            existing.UpdatedAt = now;
        }

        await db.SaveChangesAsync(ct);
    }
}
