using ModuleRegistry.Domain.Enums;

namespace ModuleRegistry.Domain.Entities;

/// <summary>
/// One registered remote micro-frontend. ManifestUrl is the single mf-manifest.json URL an admin
/// pastes in — the host reads the remote's name/remoteEntry/exposed modules from it at runtime,
/// nothing else about the remote is hardcoded anywhere in the host's build.
/// </summary>
public class RemoteApp
{
    public Guid Id { get; set; }

    /// <summary>Stable slug — the Module Federation runtime registration name. Immutable after creation (changing it would orphan already-cached registrations and its permission feature).</summary>
    public required string Key { get; set; }

    public required string DisplayName { get; set; }

    /// <summary>Icon identifier from the host's small built-in icon set (not a file upload — see plan assumptions).</summary>
    public string? IconKey { get; set; }

    public required string ManifestUrl { get; set; }

    public int SidebarOrder { get; set; }

    public RemoteAppStatus Status { get; set; } = RemoteAppStatus.Active;

    /// <summary>Shown on MaintenancePage in place of the remote while Status == Maintenance. Admin-authored, not a hardcoded string.</summary>
    public string? MaintenanceMessage { get; set; }

    /// <summary>Derived as "remote.{Key}" at creation — the PermissionFeature.Key this app is gated by in AuthDb. Loose reference only, no cross-database FK.</summary>
    public required string PermissionFeatureKey { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
