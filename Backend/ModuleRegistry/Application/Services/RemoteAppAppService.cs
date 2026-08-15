using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using ModuleRegistry.Application.DTOs;
using ModuleRegistry.Application.Exceptions;
using ModuleRegistry.Domain.Entities;
using ModuleRegistry.Domain.Enums;
using ModuleRegistry.Infrastructure;

namespace ModuleRegistry.Application.Services;

public partial class RemoteAppAppService(ModuleRegistryDbContext db, AuthServiceClient authServiceClient, ILogger<RemoteAppAppService> logger)
{
    [GeneratedRegex("^[a-z0-9][a-z0-9-]{1,49}$")]
    private static partial Regex KeyPattern();

    public async Task<PagedResult<RemoteAppDto>> ListAsync(int page, int pageSize, string? search, CancellationToken ct = default)
    {
        var query = db.RemoteApps.AsNoTracking().Include(a => a.Capabilities).AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(a => a.DisplayName.ToLower().Contains(term) || a.Key.ToLower().Contains(term));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(a => a.SidebarOrder).ThenBy(a => a.DisplayName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<RemoteAppDto>(items.Select(ToDto).ToList(), total, page, pageSize);
    }

    public async Task<RemoteAppDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var app = await db.RemoteApps.AsNoTracking().Include(a => a.Capabilities).FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw NotFound(id);
        return ToDto(app);
    }

    public async Task<RemoteAppDto> CreateAsync(CreateRemoteAppRequest request, Guid? actingUserId, string? actorName, CancellationToken ct = default)
    {
        var key = request.Key.Trim().ToLowerInvariant();
        if (!KeyPattern().IsMatch(key))
        {
            throw new ValidationAppException("Key must be 2-50 lowercase letters, digits, or hyphens, starting with a letter or digit.");
        }

        if (await db.RemoteApps.AnyAsync(a => a.Key == key, ct))
        {
            throw new ConflictAppException($"A remote app with key '{key}' already exists.");
        }

        if (string.IsNullOrWhiteSpace(request.ManifestUrl) || !Uri.TryCreate(request.ManifestUrl, UriKind.Absolute, out _))
        {
            throw new ValidationAppException("ManifestUrl must be a valid absolute URL to an mf-manifest.json.");
        }

        if (!string.IsNullOrWhiteSpace(request.PermissionsSourceUrl) && !Uri.TryCreate(request.PermissionsSourceUrl, UriKind.Absolute, out _))
        {
            throw new ValidationAppException("PermissionsSourceUrl must be a valid absolute URL.");
        }

        var now = DateTimeOffset.UtcNow;
        var featureKey = ToFeatureKey(key);
        var displayName = request.DisplayName.Trim();
        var sourceUrl = request.PermissionsSourceUrl?.Trim();

        var app = new RemoteApp
        {
            Id = Guid.NewGuid(),
            Key = key,
            DisplayName = displayName,
            IconKey = request.IconKey?.Trim(),
            ManifestUrl = request.ManifestUrl.Trim(),
            SidebarOrder = request.SidebarOrder,
            Status = RemoteAppStatus.Active,
            PermissionFeatureKey = featureKey,
            PermissionsSourceUrl = sourceUrl,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedBy = actingUserId,
            UpdatedBy = actingUserId,
        };

        db.RemoteApps.Add(app);
        await db.SaveChangesAsync(ct);

        if (!string.IsNullOrWhiteSpace(sourceUrl))
        {
            await RefreshCapabilitiesFromSourceAsync(app, sourceUrl, ct);
        }

        await authServiceClient.UpsertAsync(featureKey, displayName, request.SidebarOrder, ToCapabilityTuples(app), ct);
        await authServiceClient.PushAuditLogAsync("remoteapp.created", "RemoteApp", app.Id.ToString(), $"Registered remote app '{displayName}' ({key}).", actingUserId, actorName, ct);

        return ToDto(app);
    }

    public async Task<RemoteAppDto> UpdateAsync(Guid id, UpdateRemoteAppRequest request, Guid? actingUserId, string? actorName, CancellationToken ct = default)
    {
        var app = await db.RemoteApps.Include(a => a.Capabilities).FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw NotFound(id);

        if (string.IsNullOrWhiteSpace(request.ManifestUrl) || !Uri.TryCreate(request.ManifestUrl, UriKind.Absolute, out _))
        {
            throw new ValidationAppException("ManifestUrl must be a valid absolute URL to an mf-manifest.json.");
        }

        if (!string.IsNullOrWhiteSpace(request.PermissionsSourceUrl) && !Uri.TryCreate(request.PermissionsSourceUrl, UriKind.Absolute, out _))
        {
            throw new ValidationAppException("PermissionsSourceUrl must be a valid absolute URL.");
        }

        var newSourceUrl = request.PermissionsSourceUrl?.Trim();

        app.DisplayName = request.DisplayName.Trim();
        app.IconKey = request.IconKey?.Trim();
        app.ManifestUrl = request.ManifestUrl.Trim();
        app.PermissionsSourceUrl = newSourceUrl;
        app.SidebarOrder = request.SidebarOrder;
        app.UpdatedAt = DateTimeOffset.UtcNow;
        app.UpdatedBy = actingUserId;

        await db.SaveChangesAsync(ct);

        if (!string.IsNullOrWhiteSpace(newSourceUrl))
        {
            // Always re-fetch on save (not just when the URL itself changed) — this is also how an
            // admin picks up a remote app's newly-added capability without waiting for the periodic
            // resync, by simply opening and saving the edit form (or hitting Resync directly).
            await RefreshCapabilitiesFromSourceAsync(app, newSourceUrl, ct);
        }
        else if (string.IsNullOrWhiteSpace(newSourceUrl) && app.Capabilities.Count > 0)
        {
            db.RemoteAppCapabilities.RemoveRange(app.Capabilities);
            app.Capabilities.Clear();
            await db.SaveChangesAsync(ct);
        }

        if (app.Status != RemoteAppStatus.Disabled)
        {
            await authServiceClient.UpsertAsync(app.PermissionFeatureKey, app.DisplayName, app.SidebarOrder, ToCapabilityTuples(app), ct);
        }

        await authServiceClient.PushAuditLogAsync("remoteapp.updated", "RemoteApp", app.Id.ToString(), $"Updated remote app '{app.DisplayName}' ({app.Key}).", actingUserId, actorName, ct);

        return ToDto(app);
    }

    public async Task<RemoteAppDto> UpdateStatusAsync(Guid id, string status, string? maintenanceMessage, Guid? actingUserId, string? actorName, CancellationToken ct = default)
    {
        var app = await db.RemoteApps.Include(a => a.Capabilities).FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw NotFound(id);

        if (!Enum.TryParse<RemoteAppStatus>(status, out var parsedStatus))
        {
            throw new ValidationAppException($"Unknown status '{status}'. Expected Active, Maintenance, or Disabled.");
        }

        var wasDisabled = app.Status == RemoteAppStatus.Disabled;
        var becomingDisabled = parsedStatus == RemoteAppStatus.Disabled;

        app.Status = parsedStatus;
        app.MaintenanceMessage = parsedStatus == RemoteAppStatus.Maintenance ? maintenanceMessage?.Trim() : app.MaintenanceMessage;
        app.UpdatedAt = DateTimeOffset.UtcNow;
        app.UpdatedBy = actingUserId;

        await db.SaveChangesAsync(ct);

        // Disabling a remote app must pull its permission feature out of every role/override editor —
        // a Disabled app is not merely hidden from the sidebar, its capabilities stop being assignable
        // anywhere in the host. Re-activating (from Disabled) re-pushes the last-known capability set
        // so assignability comes back without the admin having to touch anything else.
        if (becomingDisabled && !wasDisabled)
        {
            await authServiceClient.DeactivateAsync(app.PermissionFeatureKey, ct);
        }
        else if (!becomingDisabled && wasDisabled)
        {
            await authServiceClient.UpsertAsync(app.PermissionFeatureKey, app.DisplayName, app.SidebarOrder, ToCapabilityTuples(app), ct);
        }

        await authServiceClient.PushAuditLogAsync(
            "remoteapp.status_changed", "RemoteApp", app.Id.ToString(),
            $"Set '{app.DisplayName}' ({app.Key}) status to {parsedStatus}.", actingUserId, actorName, ct);

        return ToDto(app);
    }

    public async Task DeleteAsync(Guid id, Guid? actingUserId, string? actorName, CancellationToken ct = default)
    {
        var app = await db.RemoteApps.FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw NotFound(id);
        var displayName = app.DisplayName;
        var key = app.Key;

        db.RemoteApps.Remove(app);
        await db.SaveChangesAsync(ct);

        await authServiceClient.DeactivateAsync(app.PermissionFeatureKey, ct);
        await authServiceClient.PushAuditLogAsync("remoteapp.deleted", "RemoteApp", id.ToString(), $"Removed remote app '{displayName}' ({key}).", actingUserId, actorName, ct);
    }

    /// <summary>
    /// Recovery utility — re-fetches every registered app's capabilities from its PermissionsSourceUrl
    /// (where set) and re-pushes every non-Disabled app's permission feature to AuthService.
    /// </summary>
    public async Task<int> ResyncPermissionsAsync(CancellationToken ct = default)
    {
        var apps = await db.RemoteApps.Include(a => a.Capabilities).ToListAsync(ct);

        foreach (var app in apps)
        {
            if (!string.IsNullOrWhiteSpace(app.PermissionsSourceUrl))
            {
                await RefreshCapabilitiesFromSourceAsync(app, app.PermissionsSourceUrl, ct);
            }
        }

        var active = apps.Where(a => a.Status != RemoteAppStatus.Disabled).ToList();
        var features = active
            .Select(a => (a.PermissionFeatureKey, a.DisplayName, a.SidebarOrder, ToCapabilityTuples(a)))
            .ToList();
        await authServiceClient.ResyncAsync(features, ct);

        return apps.Count;
    }

    /// <summary>
    /// What the host's sidebar actually fetches. Excludes Disabled apps entirely; Active/Maintenance
    /// apps are further filtered to whether the caller's token grants ANY capability on this app's
    /// feature (not specifically "View" — a remote may not declare a "View" capability at all, e.g.
    /// one that only exposes Create/Edit actions inside its own UI), or everything for administrators.
    /// </summary>
    public async Task<IReadOnlyList<SidebarAppDto>> GetForSidebarAsync(bool isAdministrator, IReadOnlySet<string> permissions, CancellationToken ct = default)
    {
        var apps = await db.RemoteApps
            .AsNoTracking()
            .Where(a => a.Status != RemoteAppStatus.Disabled)
            .OrderBy(a => a.SidebarOrder).ThenBy(a => a.DisplayName)
            .ToListAsync(ct);

        var visible = isAdministrator
            ? apps
            : apps.Where(a => permissions.Any(p => p.StartsWith($"{a.PermissionFeatureKey}:", StringComparison.Ordinal))).ToList();

        return visible
            .Select(a => new SidebarAppDto(a.Key, a.DisplayName, a.IconKey, a.ManifestUrl, a.SidebarOrder, a.Status.ToString(), a.MaintenanceMessage))
            .ToList();
    }

    /// <summary>Fetches the remote's declared capabilities and fully replaces the local RemoteAppCapability cache for it. No-ops (keeps last-known set) if the remote is unreachable.</summary>
    private async Task RefreshCapabilitiesFromSourceAsync(RemoteApp app, string sourceUrl, CancellationToken ct)
    {
        var fetched = await authServiceClient.FetchRemoteCapabilitiesAsync(sourceUrl, ct);
        if (fetched is null)
        {
            logger.LogWarning("Keeping last-known capability set for '{Key}' — permissions source unreachable or invalid.", app.Key);
            return;
        }

        db.RemoteAppCapabilities.RemoveRange(app.Capabilities);
        app.Capabilities.Clear();

        var i = 0;
        var newCapabilities = new List<RemoteAppCapability>();
        foreach (var (capKey, displayName) in fetched)
        {
            newCapabilities.Add(new RemoteAppCapability
            {
                Id = Guid.NewGuid(),
                RemoteAppId = app.Id,
                Key = capKey,
                DisplayName = displayName,
                SortOrder = i * 10,
            });
            i++;
        }

        // Add via the DbSet directly (not app.Capabilities.Add(...)) — these entities carry a
        // client-generated, non-default Guid key, and EF's change-tracker heuristic for entities
        // reached only through navigation fixup treats a non-default key as "probably already
        // exists", issuing UPDATEs instead of INSERTs (a real bug caught via live end-to-end
        // testing: DbUpdateConcurrencyException, 0 rows affected).
        db.RemoteAppCapabilities.AddRange(newCapabilities);
        await db.SaveChangesAsync(ct);

        // EF's relationship fixup during the SaveChanges above may ALSO have wired these into
        // app.Capabilities on its own (same tracked entities, matching FK) — reset explicitly
        // rather than trust that timing, so callers reading app.Capabilities right after this
        // method (e.g. ToCapabilityTuples, pushed straight to AuthService) see exactly
        // newCapabilities once each, never doubled. This exact doubling was caught live: it sent 6
        // capability rows for 3 real ones and tripped AuthService's own unique constraint.
        app.Capabilities.Clear();
        foreach (var capability in newCapabilities)
        {
            app.Capabilities.Add(capability);
        }
    }

    private static IReadOnlyList<(string Key, string DisplayName)> ToCapabilityTuples(RemoteApp app) =>
        app.Capabilities.OrderBy(c => c.SortOrder).Select(c => (c.Key, c.DisplayName)).ToList();

    private static string ToFeatureKey(string key) => $"remote.{key}";

    private static RemoteAppDto ToDto(RemoteApp a) => new(
        a.Id, a.Key, a.DisplayName, a.IconKey, a.ManifestUrl, a.SidebarOrder,
        a.Status.ToString(), a.MaintenanceMessage, a.PermissionFeatureKey, a.PermissionsSourceUrl,
        a.Capabilities.OrderBy(c => c.SortOrder).Select(c => new CapabilityDto(c.Key, c.DisplayName)).ToList(),
        a.CreatedAt, a.UpdatedAt);

    private static NotFoundAppException NotFound(Guid id) => new($"Remote app '{id}' was not found.");
}
