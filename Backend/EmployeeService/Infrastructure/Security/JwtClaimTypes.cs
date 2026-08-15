namespace EmployeeService.Infrastructure.Security;

/// <summary>
/// Mirrors the claim type names AuthService.Infrastructure.Security.JwtTokenService embeds into
/// access tokens. Must stay byte-for-byte identical to that side's constants — these services
/// deliberately don't share a code package (independent deployability), so this is the one place
/// the string contract has to be kept in sync by hand. Same convention as ModuleRegistry's copy.
/// </summary>
public static class JwtClaimTypes
{
    public const string Administrator = "administrator";
    public const string Permissions = "perms";
}
