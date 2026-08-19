using System;
using System.Text.Json.Serialization;

namespace backend.Models
{
    /// <summary>
    /// Which Customer 360 profile shape a field config row applies to. Individual and Corporate
    /// profiles have entirely different field sets (see IndividualProfile/CorporateProfile in
    /// Models.cs), so the same ApiField name ("phone", say) can independently exist — or not — in
    /// each, with its own label/section/order/masking.
    /// </summary>
    public enum ProfileType
    {
        Individual,
        Corporate,
    }

    /// <summary>
    /// The four masking shapes an admin can choose for a sensitive field. Each is parameterized by
    /// FieldConfig.VisibleCharCount rather than a fixed count baked into the rule itself — "hide all
    /// but the last 4" and "hide all but the last 2" are the same rule with a different admin-chosen
    /// count, not two different rules.
    /// </summary>
    public enum MaskingRule
    {
        /// <summary>Not masked — full value shown. Only meaningful when Sensitive is false.</summary>
        None,
        /// <summary>e.g. "*******5421" — everything hidden except the last VisibleCharCount characters.</summary>
        HideFirstShowLast,
        /// <summary>e.g. "5421*******" — everything hidden except the first VisibleCharCount characters.</summary>
        HideLastShowFirst,
        /// <summary>e.g. "54**********21" — first and last VisibleCharCount characters shown, middle hidden.</summary>
        HideMiddleShowFirstAndLast,
        /// <summary>Every character replaced with a mask character, regardless of length.</summary>
        FullMask,
    }

    /// <summary>
    /// Admin-configurable rendering rule for one Customer 360 profile field: whether it's shown at
    /// all, what label/section/order it renders under, and — for sensitive fields — how it's masked.
    /// This table is the sole source of truth the frontend renders profile detail pages from; the
    /// underlying CRM API response itself is never altered, only what the UI does with it.
    /// </summary>
    public class FieldConfig
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        [JsonPropertyName("profileType")]
        public ProfileType ProfileType { get; set; }

        /// <summary>
        /// The camelCase field name exactly as it appears in the frontend's IndividualProfile /
        /// CorporateProfile / ContactDetail types (e.g. "nationalId", "birthDate"). A "contact."
        /// prefix (e.g. "contact.contactNumber") means the value lives on the separate ContactDetail
        /// object returned by GET /v1/contactinfo, not on the profile itself.
        /// </summary>
        [JsonPropertyName("apiField")]
        public string ApiField { get; set; } = string.Empty;

        [JsonPropertyName("displayLabel")]
        public string DisplayLabel { get; set; } = string.Empty;

        [JsonPropertyName("visible")]
        public bool Visible { get; set; } = true;

        [JsonPropertyName("section")]
        public string Section { get; set; } = string.Empty;

        [JsonPropertyName("displayOrder")]
        public int DisplayOrder { get; set; }

        [JsonPropertyName("sensitive")]
        public bool Sensitive { get; set; }

        [JsonPropertyName("maskingRule")]
        public MaskingRule MaskingRule { get; set; } = MaskingRule.None;

        /// <summary>How many characters stay visible under the chosen masking rule. Ignored for
        /// FullMask and None.</summary>
        [JsonPropertyName("visibleCharCount")]
        public int VisibleCharCount { get; set; } = 4;
    }
}
