namespace LeadManagement.Api.Options;

public class AuthIntegrationOptions
{
    public const string SectionName = "AuthService";

    /// <summary>Base URL for AuthService, e.g. http://localhost:5155.</summary>
    public string BaseUrl { get; set; } = string.Empty;

    /// <summary>Shared static API key passed in the X-Internal-Api-Key header.</summary>
    public string InternalApiKey { get; set; } = string.Empty;
}
