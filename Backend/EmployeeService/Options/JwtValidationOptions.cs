namespace EmployeeService.Options;

/// <summary>
/// Bound from the "Jwt" section. EmployeeService only ever validates tokens — it is deliberately
/// given just the RS256 public key, never AuthService's private signing key. Issuer/Audience/
/// SigningKeyPublic must match AuthService's own Jwt config exactly (same pattern as ModuleRegistry).
/// </summary>
public class JwtValidationOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "omniremit-auth-service";
    public string Audience { get; set; } = "omniremit-host";
    public string SigningKeyPublic { get; set; } = string.Empty;
}
