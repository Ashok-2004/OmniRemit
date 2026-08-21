namespace LeadManagement.Api.Options;

/// <summary>
/// Bound from the "Self" config section. This service's own externally-reachable base URL, handed to
/// AuthService as the CallbackUrl on every gated Lead mutation submitted for approval, and the module
/// key this service was registered under in Setup → Applications (a runtime fact assigned at
/// registration time — this service cannot self-derive it, hence the explicit config value).
/// </summary>
public class SelfOptions
{
    public const string SectionName = "Self";

    public string PublicBaseUrl { get; set; } = string.Empty;

    /// <summary>The live PermissionFeature.Key synced for this service's "Lead" [RequiresCapability]
    /// module (e.g. "remote.leadmanagement.lead") — set to match whatever this app was actually
    /// registered as in Setup → Applications. See ApprovalDtos.cs's doc comment for why this can't be
    /// derived in code.</summary>
    public string LeadModuleKey { get; set; } = string.Empty;

    /// <summary>Same idea as <see cref="LeadModuleKey"/>, for the separate "FieldSettings"
    /// [RequiresCapability] module — Field Settings gates independently of Lead itself.</summary>
    public string FieldSettingsModuleKey { get; set; } = string.Empty;
}
