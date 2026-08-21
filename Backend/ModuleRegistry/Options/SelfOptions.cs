namespace ModuleRegistry.Options;

/// <summary>
/// Bound from the "Self" config section. This service's own externally-reachable base URL — handed to
/// AuthService as the CallbackUrl on every gated mutation it submits, so an approved request gets
/// replayed back here (POST {PublicBaseUrl}/internal/approvals/apply). Unlike AuthService:BaseUrl
/// (which this service already knows), a service cannot reliably derive its own public URL from
/// HttpContext behind a reverse proxy, so this is one explicit, deployment-specific value.
/// </summary>
public class SelfOptions
{
    public const string SectionName = "Self";

    public string PublicBaseUrl { get; set; } = string.Empty;
}
