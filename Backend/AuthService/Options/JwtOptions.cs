namespace AuthService.Options;

/// <summary>
/// Bound from the "Jwt" config section. Access tokens are signed RS256 — AuthService holds both
/// keys, ModuleRegistry (see its own JwtOptions) is only ever given the public one.
/// PEM values are expected with literal "\n" sequences (the common env-var-safe encoding for
/// multi-line PEM content) and are unescaped before parsing — see Security/RsaKeyLoader.
/// </summary>
public class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "omniremit-auth-service";
    public string Audience { get; set; } = "omniremit-host";
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 14;
    public string SigningKeyPrivate { get; set; } = string.Empty;
    public string SigningKeyPublic { get; set; } = string.Empty;
}
