namespace AuthService.Options;

/// <summary>Bound from the "Cors" config section (env var: Cors__AllowedOrigins__0, __1, ... or a JSON array in appsettings).</summary>
public class CorsOptions
{
    public const string SectionName = "Cors";

    public string[] AllowedOrigins { get; set; } = [];
}
