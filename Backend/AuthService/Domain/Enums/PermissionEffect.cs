namespace AuthService.Domain.Enums;

/// <summary>How a per-user permission override modifies the capability the user's role already grants (or doesn't).</summary>
public enum PermissionEffect
{
    Grant = 0,
    Revoke = 1,
}
