using AuthService.Domain.Enums;

namespace AuthService.Domain.Entities;

/// <summary>
/// One row per grantable "feature" in the permission matrix (e.g. "host.settings.users",
/// "remote.whatsapp-console"). Host features are seeded at startup; RemoteApp features are
/// upserted by the Module Registry service's internal client whenever an admin registers,
/// edits, or removes a remote app — this table is the single source of truth the Role editor
/// (Features/Capabilities matrix) and the JWT permission claims are both built from.
/// </summary>
public class PermissionFeature
{
    public Guid Id { get; set; }
    public required string Key { get; set; }
    public required string DisplayName { get; set; }
    public PermissionFeatureSource Source { get; set; }

    /// <summary>Soft-disable flag. Set false instead of deleting when a remote app is removed, so historical RolePermission/UserPermissionOverride rows never dangle.</summary>
    public bool IsActive { get; set; } = true;

    public int SortOrder { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
    public ICollection<UserPermissionOverride> UserPermissionOverrides { get; set; } = new List<UserPermissionOverride>();
}
