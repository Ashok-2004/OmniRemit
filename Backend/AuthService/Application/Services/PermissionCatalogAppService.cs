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

        // Nest sub-modules under their parent rather than returning a flat list — the Role editor
        // renders a module as a table whose ROWS are its sub-modules, so a flat list would show
        // "Employee Management" and "Department" as unrelated siblings.
        var childrenByParent = features
            .Where(f => f.ParentFeatureId is not null)
            .GroupBy(f => f.ParentFeatureId!.Value)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<PermissionFeature>)g.ToList());

        return features
            .Where(f => f.ParentFeatureId is null)
            .Select(f => ToDto(f, childrenByParent.GetValueOrDefault(f.Id)))
            .ToList();
    }

    /// <summary>
    /// Upserts a RemoteApp feature, its sub-modules (as child features), and fully replaces every
    /// capability set involved. Idempotent — the same full-replace pattern used for RolePermissions
    /// on role save.
    /// </summary>
    public async Task UpsertRemoteAppFeatureAsync(
        string key,
        string displayName,
        int sortOrder,
        IReadOnlyList<UpsertCapabilityRequest> capabilities,
        IReadOnlyList<UpsertModuleRequest>? modules = null,
        CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var parent = await UpsertFeatureRowAsync(key, displayName, sortOrder, capabilities, parentId: null, now, ct);

        var incomingModules = modules ?? [];
        var childKeys = incomingModules.Select(m => $"{key}.{m.Key}").ToHashSet(StringComparer.Ordinal);

        foreach (var module in incomingModules)
        {
            await UpsertFeatureRowAsync(
                $"{key}.{module.Key}", module.DisplayName, module.SortOrder, module.Capabilities, parent.Id, now, ct);
        }

        // A sub-module the remote no longer declares is DEACTIVATED, never deleted — deleting it
        // would orphan every RolePermission still pointing at it, and those rows are the record of
        // what an administrator actually granted. Deactivated features drop out of the Role editor
        // and out of the JWT, which is the intended effect, while the history survives.
        var staleChildren = await db.PermissionFeatures
            .Where(f => f.ParentFeatureId == parent.Id && f.IsActive)
            .ToListAsync(ct);

        foreach (var stale in staleChildren.Where(c => !childKeys.Contains(c.Key)))
        {
            stale.IsActive = false;
            stale.UpdatedAt = now;
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>Creates or updates one feature row and fully replaces its capabilities. Does not save.</summary>
    private async Task<PermissionFeature> UpsertFeatureRowAsync(
        string key,
        string displayName,
        int sortOrder,
        IReadOnlyList<UpsertCapabilityRequest> capabilities,
        Guid? parentId,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var existing = await db.PermissionFeatures.Include(f => f.Capabilities).FirstOrDefaultAsync(f => f.Key == key, ct);

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
                ParentFeatureId = parentId,
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
            existing.ParentFeatureId = parentId;
            existing.UpdatedAt = now;
            db.PermissionFeatureCapabilities.RemoveRange(existing.Capabilities);
        }

        foreach (var capability in capabilities)
        {
            db.PermissionFeatureCapabilities.Add(new PermissionFeatureCapability
            {
                Id = Guid.NewGuid(),
                FeatureId = existing.Id,
                Key = capability.Key,
                DisplayName = capability.DisplayName,
                SortOrder = capability.SortOrder,
            });
        }

        return existing;
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
            // Named `ct:` — UpsertRemoteAppFeatureAsync gained a `modules` parameter before the
            // cancellation token, so a positional call would silently bind `ct` to `modules`.
            await UpsertRemoteAppFeatureAsync(
                incoming.Key, incoming.DisplayName, incoming.SortOrder, incoming.Capabilities, incoming.Modules, ct: ct);
        }

        var now = DateTimeOffset.UtcNow;

        // Only TOP-LEVEL features are swept here. Child features (sub-modules) carry keys like
        // "remote.employee.department", which never appear in incomingKeys — sweeping them by the
        // same rule would deactivate every sub-module of every app on each resync, silently stripping
        // those permissions from everyone. Children are reconciled by UpsertRemoteAppFeatureAsync,
        // which knows which sub-modules its own app actually declared.
        foreach (var existing in existingRemoteFeatures.Where(f =>
                     f.ParentFeatureId is null && !incomingKeys.Contains(f.Key) && f.IsActive))
        {
            existing.IsActive = false;
            existing.UpdatedAt = now;

            // A module going away takes its sub-modules with it.
            foreach (var child in existingRemoteFeatures.Where(c => c.ParentFeatureId == existing.Id && c.IsActive))
            {
                child.IsActive = false;
                child.UpdatedAt = now;
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private static PermissionFeatureDto ToDto(PermissionFeature f, IReadOnlyList<PermissionFeature>? children = null) => new(
        f.Id, f.Key, f.DisplayName, f.Source.ToString(), f.SortOrder,
        f.Capabilities.OrderBy(c => c.SortOrder).Select(c => new CapabilityDto(c.Key, c.DisplayName)).ToList(),
        (children ?? [])
            .OrderBy(c => c.SortOrder).ThenBy(c => c.DisplayName)
            .Select(c => ToDto(c))
            .ToList());
}
