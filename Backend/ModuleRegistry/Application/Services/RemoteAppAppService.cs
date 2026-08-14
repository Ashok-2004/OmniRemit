using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using ModuleRegistry.Application.DTOs;
using ModuleRegistry.Application.Exceptions;
using ModuleRegistry.Domain.Entities;
using ModuleRegistry.Domain.Enums;
using ModuleRegistry.Infrastructure;

namespace ModuleRegistry.Application.Services;

public partial class RemoteAppAppService(ModuleRegistryDbContext db, AuthServiceClient authServiceClient)
{
    [GeneratedRegex("^[a-z0-9][a-z0-9-]{1,49}$")]
    private static partial Regex KeyPattern();

    public async Task<PagedResult<RemoteAppDto>> ListAsync(int page, int pageSize, string? search, CancellationToken ct = default)
    {
        var query = db.RemoteApps.AsNoTracking().AsQueryable();

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
            .Select(a => ToDto(a))
            .ToListAsync(ct);

        return new PagedResult<RemoteAppDto>(items, total, page, pageSize);
    }

    public async Task<RemoteAppDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var app = await db.RemoteApps.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw NotFound(id);
        return ToDto(app);
    }

    public async Task<RemoteAppDto> CreateAsync(CreateRemoteAppRequest request, Guid? actingUserId, CancellationToken ct = default)
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

        var now = DateTimeOffset.UtcNow;
        var featureKey = ToFeatureKey(key);
        var displayName = request.DisplayName.Trim();

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
            CreatedAt = now,
            UpdatedAt = now,
            CreatedBy = actingUserId,
            UpdatedBy = actingUserId,
        };

        db.RemoteApps.Add(app);
        await db.SaveChangesAsync(ct);

        await authServiceClient.UpsertAsync(featureKey, displayName, request.SidebarOrder, ct);

        return ToDto(app);
    }

    public async Task<RemoteAppDto> UpdateAsync(Guid id, UpdateRemoteAppRequest request, Guid? actingUserId, CancellationToken ct = default)
    {
        var app = await db.RemoteApps.FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw NotFound(id);

        if (string.IsNullOrWhiteSpace(request.ManifestUrl) || !Uri.TryCreate(request.ManifestUrl, UriKind.Absolute, out _))
        {
            throw new ValidationAppException("ManifestUrl must be a valid absolute URL to an mf-manifest.json.");
        }

        app.DisplayName = request.DisplayName.Trim();
        app.IconKey = request.IconKey?.Trim();
        app.ManifestUrl = request.ManifestUrl.Trim();
        app.SidebarOrder = request.SidebarOrder;
        app.UpdatedAt = DateTimeOffset.UtcNow;
        app.UpdatedBy = actingUserId;

        await db.SaveChangesAsync(ct);
        await authServiceClient.UpsertAsync(app.PermissionFeatureKey, app.DisplayName, app.SidebarOrder, ct);

        return ToDto(app);
    }

    public async Task<RemoteAppDto> UpdateStatusAsync(Guid id, string status, string? maintenanceMessage, Guid? actingUserId, CancellationToken ct = default)
    {
        var app = await db.RemoteApps.FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw NotFound(id);

        if (!Enum.TryParse<RemoteAppStatus>(status, out var parsedStatus))
        {
            throw new ValidationAppException($"Unknown status '{status}'. Expected Active, Maintenance, or Disabled.");
        }

        app.Status = parsedStatus;
        app.MaintenanceMessage = parsedStatus == RemoteAppStatus.Maintenance ? maintenanceMessage?.Trim() : app.MaintenanceMessage;
        app.UpdatedAt = DateTimeOffset.UtcNow;
        app.UpdatedBy = actingUserId;

        await db.SaveChangesAsync(ct);
        return ToDto(app);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var app = await db.RemoteApps.FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw NotFound(id);

        db.RemoteApps.Remove(app);
        await db.SaveChangesAsync(ct);

        await authServiceClient.DeactivateAsync(app.PermissionFeatureKey, ct);
    }

    /// <summary>Recovery utility — re-pushes every currently-registered app's permission feature to AuthService, regardless of Active/Maintenance/Disabled.</summary>
    public async Task<int> ResyncPermissionsAsync(CancellationToken ct = default)
    {
        var apps = await db.RemoteApps.AsNoTracking().ToListAsync(ct);
        var features = apps.Select(a => (a.PermissionFeatureKey, a.DisplayName, a.SidebarOrder)).ToList();
        await authServiceClient.ResyncAsync(features, ct);
        return apps.Count;
    }

    /// <summary>
    /// What the host's sidebar actually fetches. Excludes Disabled apps entirely; Active/Maintenance
    /// apps are further filtered to what the caller's token grants View on (or everything, for
    /// administrators) — see Controllers/RemoteAppsController's JWT claim parsing.
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
            : apps.Where(a => permissions.Contains($"{a.PermissionFeatureKey}:View")).ToList();

        return visible
            .Select(a => new SidebarAppDto(a.Key, a.DisplayName, a.IconKey, a.ManifestUrl, a.SidebarOrder, a.Status.ToString(), a.MaintenanceMessage))
            .ToList();
    }

    private static string ToFeatureKey(string key) => $"remote.{key}";

    private static RemoteAppDto ToDto(RemoteApp a) => new(
        a.Id, a.Key, a.DisplayName, a.IconKey, a.ManifestUrl, a.SidebarOrder,
        a.Status.ToString(), a.MaintenanceMessage, a.PermissionFeatureKey, a.CreatedAt, a.UpdatedAt);

    private static NotFoundAppException NotFound(Guid id) => new($"Remote app '{id}' was not found.");
}
