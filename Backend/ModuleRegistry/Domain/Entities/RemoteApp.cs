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

    /// <summary>
    /// Optional URL this app's own backend exposes declaring its current capabilities (e.g.
    /// EmployeeService's discovery endpoint, auto-generated from its [RequiresCapability]
    /// attributes). Fetched on create/update and on manual resync — a remote adding a new action
    /// just needs this endpoint to report it, nothing to hand-edit here or in AuthService.
    /// </summary>
    public string? PermissionsSourceUrl { get; set; }

    /// <summary>
    /// Result of the last reachability probe against <see cref="ManifestUrl"/>, refreshed on an
    /// interval by RemoteAppHealthProbeService. Without this the registry happily hands the host a
    /// sidebar link into an app whose server is not running — the failure only becomes visible when
    /// a user clicks it and gets a Module Federation runtime error, which is precisely the bug this
    /// closes.
    /// </summary>
    public RemoteAppHealth Health { get; set; } = RemoteAppHealth.Unknown;

    /// <summary>When the last probe ran. Null until the app has been probed at least once.</summary>
    public DateTimeOffset? LastHealthCheckAt { get; set; }

    /// <summary>The real transport/HTTP error from the last failed probe. Null when healthy — never a placeholder string.</summary>
    public string? LastHealthError { get; set; }

    /// <summary>
    /// The Module Federation container name read from the fetched manifest (e.g. "employee_mf"),
    /// which is NOT the same thing as <see cref="Key"/> (e.g. "employee"). Two different remotes
    /// built with the same container name would collide on the browser's global scope, so this is
    /// captured and uniqueness-checked at registration time.
    /// </summary>
    public string? ContainerName { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public ICollection<RemoteAppCapability> Capabilities { get; set; } = new List<RemoteAppCapability>();
}
