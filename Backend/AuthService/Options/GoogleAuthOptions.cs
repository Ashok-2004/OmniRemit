namespace AuthService.Options;

/// <summary>
/// Bound from the "Google" config section. Deliberately unset by default — no user can authenticate
/// via Google until an admin creates a real OAuth Client ID in Google Cloud Console and configures
/// both values below. See SETUP.md's "Enabling Google SSO" section for the exact steps.
/// </summary>
public class GoogleAuthOptions
{
    public const string SectionName = "Google";

    /// <summary>OAuth 2.0 Client ID from Google Cloud Console — the ID token's "aud" claim must match this exactly.</summary>
    public string ClientId { get; set; } = string.Empty;

    /// <summary>Comma-separated list of email domains allowed to sign in via Google (e.g. "acme.com,acme.co.uk"). Empty means nobody can.</summary>
    public string AllowedDomains { get; set; } = string.Empty;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(AllowedDomains);

    public IReadOnlyList<string> AllowedDomainsList =>
        AllowedDomains.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
