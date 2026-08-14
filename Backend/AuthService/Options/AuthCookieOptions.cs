namespace AuthService.Options;

/// <summary>Bound from the "Auth" config section — controls how the httpOnly refresh-token cookie is issued.</summary>
public class AuthCookieOptions
{
    public const string SectionName = "Auth";

    public string RefreshCookieName { get; set; } = "omniremit_refresh";

    /// <summary>Leave empty for localhost development (browser infers the current host).</summary>
    public string RefreshCookieDomain { get; set; } = string.Empty;
}
