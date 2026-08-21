namespace backend.Options;

/// <summary>
/// Bound from the "Self" config section. This service's own externally-reachable base URL, handed to
/// AuthService as the CallbackUrl on every gated Field Settings mutation submitted for approval, and
/// the module key this service was registered under in Setup → Applications (a runtime fact assigned
/// at registration time — this service cannot self-derive it, hence the explicit config value).
/// </summary>
public class SelfOptions
{
    public const string SectionName = "Self";

    public string PublicBaseUrl { get; set; } = string.Empty;

    /// <summary>The live PermissionFeature.Key synced for this service's "fieldsettings"
    /// [RequiresCapability] module (e.g. "remote.customer360.fieldsettings") — set to match whatever
    /// this app was actually registered as in Setup → Applications.</summary>
    public string FieldSettingsModuleKey { get; set; } = string.Empty;
}
