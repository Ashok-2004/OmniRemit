namespace AuthService.Domain.Entities;

/// <summary>
/// One capability a specific PermissionFeature actually grants (e.g. "Create" on "remote.employee").
/// Replaces a fixed global capability enum applied uniformly to every feature — the Role editor and
/// User override editor render exactly this set per feature, nothing more.
/// </summary>
public class PermissionFeatureCapability
{
    public Guid Id { get; set; }

    public Guid FeatureId { get; set; }
    public PermissionFeature? Feature { get; set; }

    /// <summary>Stable key used in RolePermission/UserPermissionOverride.Capability and in the JWT's "perms" claim, e.g. "Create".</summary>
    public required string Key { get; set; }

    public required string DisplayName { get; set; }
    public int SortOrder { get; set; }
}
