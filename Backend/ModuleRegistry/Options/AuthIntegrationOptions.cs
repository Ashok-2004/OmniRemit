namespace ModuleRegistry.Options;

/// <summary>Bound from the "AuthService" section — how this service reaches AuthService's internal permission-feature-sync endpoints.</summary>
public class AuthIntegrationOptions
{
    public const string SectionName = "AuthService";

    public string BaseUrl { get; set; } = string.Empty;

    /// <summary>Sent as X-Internal-Api-Key. Must match Internal__ApiKey in Backend/AuthService/.env.</summary>
    public string InternalApiKey { get; set; } = string.Empty;
}
