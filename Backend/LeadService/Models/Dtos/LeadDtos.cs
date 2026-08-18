using System.ComponentModel.DataAnnotations;

namespace LeadManagement.Api.Models.Dtos
{
    public class DropdownOptionDto
    {
        public string Value { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string? Description { get; set; }
    }

    public class ReferenceDataDto
    {
        public List<DropdownOptionDto> PropertyTypes { get; set; } = new();
        public List<DropdownOptionDto> PropertyStatuses { get; set; } = new();
        public List<DropdownOptionDto> EntityTypes { get; set; } = new();
    }

    public class CreateLeadDto
    {
        [Required(ErrorMessage = "Product selection is required.")]
        public string Product { get; set; } = string.Empty;

        [Required(ErrorMessage = "Customer Name is required.")]
        public string CustomerName { get; set; } = string.Empty;

        [Required(ErrorMessage = "IC Number is required.")]
        [RegularExpression(@"^\d{6}-\d{2}-\d{4}$", ErrorMessage = "Please enter IC Number in format YYMMDD-PB-XXXX (e.g. 880512-14-5678).")]
        public string IcNumber { get; set; } = string.Empty;

        public string PhoneCountryCode { get; set; } = "+60";

        [Required(ErrorMessage = "Phone number is required.")]
        [RegularExpression(@"^\+60\s?[1-9]\d{1,2}-?\d{3,4}\s?\d{3,4}$|^\+60[1-9]\d{7,9}$|^[1-9]\d{7,9}$", ErrorMessage = "Please enter a valid Malaysian phone number.")]
        public string PhoneNumber { get; set; } = string.Empty;

        [Required(ErrorMessage = "Email address is required.")]
        [EmailAddress(ErrorMessage = "Please enter a valid email address.")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "State is required.")]
        public string State { get; set; } = string.Empty;

        public string PreferredBranch { get; set; } = string.Empty;

        [Required(ErrorMessage = "Employer Name is required.")]
        public string EmployerName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Applied Amount is required.")]
        public string AppliedAmount { get; set; } = string.Empty;

        public bool HasPreferredSalesExecutive { get; set; } = false;

        public string PreferredSalesExecutive { get; set; } = string.Empty;

        // Product specific fields
        public string PropertyType { get; set; } = string.Empty;
        public string PropertyStatus { get; set; } = string.Empty;
        public string DateOfIncorporation { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;

        // Consent
        [Required(ErrorMessage = "Consent selection is required.")]
        public string MarketingConsent { get; set; } = string.Empty;

        [Range(typeof(bool), "true", "true", ErrorMessage = "You must agree to the Privacy Policy before proceeding.")]
        public bool AgreedToPrivacyPolicy { get; set; }
    }

    public class UpdateLeadDto : CreateLeadDto
    {
        [Required(ErrorMessage = "Edit reason is required.")]
        public string EditReason { get; set; } = string.Empty;
    }

    public class DeleteLeadDto
    {
        [Required(ErrorMessage = "Delete reason is required.")]
        public string DeleteReason { get; set; } = string.Empty;
    }

    public class LeadRecordDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string IcNumber { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Product { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string Branch { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string CreatedDate { get; set; } = string.Empty;
        public string EmployerName { get; set; } = string.Empty;
        public string AppliedAmount { get; set; } = string.Empty;
        public string? PreferredSalesExecutive { get; set; }
        public string? PropertyType { get; set; }
        public string? PropertyStatus { get; set; }
        public string? DateOfIncorporation { get; set; }
        public string? CompanyName { get; set; }
        public string? EntityType { get; set; }
        public string? MarketingConsent { get; set; }
    }

    public class PagedResultDto<T>
    {
        public List<T> Items { get; set; } = new();
        public int TotalRecords { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }

    public class ApiResponseDto<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
        public string? Message { get; set; }
        public Dictionary<string, string>? Errors { get; set; }
    }
}
