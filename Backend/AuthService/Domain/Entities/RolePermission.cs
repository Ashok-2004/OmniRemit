using AuthService.Domain.Enums;

namespace AuthService.Domain.Entities;

/// <summary>One granted capability of one feature for one role. (RoleId, FeatureId, Capability) is unique.</summary>
public class RolePermission
{
    public Guid Id { get; set; }

    public Guid RoleId { get; set; }
    public Role? Role { get; set; }

    public Guid FeatureId { get; set; }
    public PermissionFeature? Feature { get; set; }

    public CapabilityType Capability { get; set; }
}
