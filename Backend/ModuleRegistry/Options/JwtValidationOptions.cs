namespace ModuleRegistry.Options;

/// <summary>
/// Bound from the "Jwt" section. ModuleRegistry only ever validates tokens (for-sidebar) — it is
/// deliberately given just the RS256 public key, never the private signing key AuthService holds.
/// Issuer/Audience/SigningKeyPublic must match AuthService's own Jwt config exactly.
/// </summary>
public class JwtValidationOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "omniremit-auth-service";
    public string Audience { get; set; } = "omniremit-host";
    public string SigningKeyPublic { get; set; } = string.Empty;
}
