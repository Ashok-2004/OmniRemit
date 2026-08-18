namespace backend.Infrastructure.Security;

/// <summary>
/// Claim type constants matching OmniRemit platform standards.
/// </summary>
public static class JwtClaimTypes
{
    public const string Subject = "sub";
    public const string Name = "name";
    public const string Email = "email";
    public const string Role = "role";
    public const string Permissions = "perms";
    public const string Administrator = "admin";
}
