using System.ComponentModel.DataAnnotations;

namespace EmployeeService.DTOs.Requests;

/// <summary>
/// Field validation as data annotations, so [ApiController] rejects bad input with a 400 and a
/// per-field error list before the request reaches the controller.
///
/// Lengths mirror AppDbContext exactly (Name 200, Email 320, Department 150) — an accepted value must
/// be a storable value, or validation has only moved the failure from a clean 400 to a 500.
/// </summary>
public class CreateEmployeeRequest
{
    [Required(AllowEmptyStrings = false, ErrorMessage = "Name is required.")]
    [MaxLength(200, ErrorMessage = "Name cannot exceed 200 characters.")]
    public string Name { get; set; } = string.Empty;

    [Required(AllowEmptyStrings = false, ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    [MaxLength(320, ErrorMessage = "Email cannot exceed 320 characters.")]
    public string Email { get; set; } = string.Empty;

    [Required(AllowEmptyStrings = false, ErrorMessage = "Department is required.")]
    [MaxLength(150, ErrorMessage = "Department cannot exceed 150 characters.")]
    public string Department { get; set; } = string.Empty;

    /// <summary>
    /// Non-negative and bounded to what the column can represent. Salary is decimal(18,2), so a value
    /// beyond that range is a database error rather than a validation message; and a negative salary is
    /// never a legitimate entry, only a typo or an attempt to probe the API.
    /// </summary>
    [Range(0, 9999999999999999.99, ErrorMessage = "Salary must be between 0 and 9,999,999,999,999,999.99.")]
    public decimal Salary { get; set; }

    public Guid RoleId { get; set; }
}
