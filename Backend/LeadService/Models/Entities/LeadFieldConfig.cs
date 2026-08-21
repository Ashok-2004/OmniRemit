using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeadManagement.Api.Models.Entities
{
    /// <summary>
    /// One field's presentation/validation rule for one Product — label, visibility, whether it's
    /// mandatory, whether it can be edited after creation, ordering, and masking for sensitive values.
    /// This is config over the fields that already exist in code (see LeadFieldConfigService's own
    /// doc comment for the fixed catalog) — never a schema/EAV mechanism for inventing new data
    /// columns. A separate implementation from Customer360Service's FieldConfig, deliberately not
    /// shared, since Lead's fields are keyed by a real Product row rather than a fixed profile-type
    /// enum, and Lead's forms need real input controls, not just masked read-only display.
    /// </summary>
    [Table("LeadFieldConfigs")]
    public class LeadFieldConfig
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid ProductId { get; set; }

        [ForeignKey(nameof(ProductId))]
        public Product? Product { get; set; }

        /// <summary>The fixed catalog key — e.g. "customerName", "propertyType". Matched by name
        /// against CreateLeadDto/UpdateLeadDto/Lead properties in LeadFieldConfigService's own
        /// GetFieldValue/GetCurrentValue switch — see that file's doc comment for the full catalog.</summary>
        [Required]
        [MaxLength(150)]
        public string ApiField { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string DisplayLabel { get; set; } = string.Empty;

        [Required]
        [MaxLength(150)]
        public string Section { get; set; } = string.Empty;

        public int DisplayOrder { get; set; }

        public bool Visible { get; set; } = true;

        /// <summary>Enforced server-side in LeadFieldConfigService's required-field check on
        /// Create/Update — not just a frontend asterisk.</summary>
        public bool Required { get; set; }

        /// <summary>Enforced server-side on Update — a changed value for a field with Editable=false
        /// is rejected, not just disabled in the UI.</summary>
        public bool Editable { get; set; } = true;

        public bool Sensitive { get; set; }

        /// <summary>One of "None", "HideFirstShowLast", "HideLastShowFirst",
        /// "HideMiddleShowFirstAndLast", "FullMask" — a plain string, not an enum, matching this
        /// service's own convention (Lead.Status is likewise a free string, no enum used anywhere in
        /// LeadService's models). Forced back to "None" whenever Sensitive is false.</summary>
        [Required]
        [MaxLength(40)]
        public string MaskingRule { get; set; } = "None";

        public int VisibleCharCount { get; set; } = 4;
    }
}
