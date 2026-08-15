namespace AuthService.Domain.Entities;

/// <summary>One granted capability of one feature for one role. (RoleId, FeatureId, Capability) is unique.</summary>
public class RolePermission
{
    public Guid Id { get; set; }

    public Guid RoleId { get; set; }
    public Role? Role { get; set; }

    public Guid FeatureId { get; set; }
    public PermissionFeature? Feature { get; set; }

    /// <summary>Must match a PermissionFeatureCapability.Key declared by this same feature — validated in the app layer, not the type system, since each feature declares its own dynamic set.</summary>
    public required string Capability { get; set; }
}
