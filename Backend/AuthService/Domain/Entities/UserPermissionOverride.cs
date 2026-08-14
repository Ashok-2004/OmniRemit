using AuthService.Domain.Enums;

namespace AuthService.Domain.Entities;

/// <summary>
/// A per-user exception layered on top of the effective permissions their role already grants —
/// Grant adds a capability the role doesn't have, Revoke removes one the role does. Computed into
/// the JWT at login/refresh, never checked live.
/// </summary>
public class UserPermissionOverride
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public User? User { get; set; }

    public Guid FeatureId { get; set; }
    public PermissionFeature? Feature { get; set; }

    public CapabilityType Capability { get; set; }
    public PermissionEffect Effect { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
}
