using System.ComponentModel.DataAnnotations;

namespace AuthService.Application.DTOs;

public record UserListItemDto(
    Guid Id,
    string Name,
    string Email,
    string? PhoneNumber,
    Guid? RoleId,
    string? RoleName,
    bool IsAdministrator,
    bool IsActive,
    DateTimeOffset? LastLoginAt,
    string AuthProvider);

public record PermissionOverrideDto(string FeatureKey, string Capability, string Effect);

public record UserDetailDto(
    Guid Id,
    string Name,
    string Email,
    string? PhoneNumber,
    Guid? RoleId,
    string? RoleName,
    bool IsAdministrator,
    bool IsActive,
    bool MustChangePassword,
    DateTimeOffset? LastLoginAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    IReadOnlyList<PermissionOverrideDto> PermissionOverrides,
    string AuthProvider);

/*
 * Field validation lives here as data annotations, so [ApiController] rejects a bad request with a 400
 * and a per-field error list before it reaches any service.
 *
 * There was previously none at all, only duplicate-email and role-exists checks. Verified against the
 * running service before this was added: POST /api/users with {"name":"","email":"not-an-email"}
 * returned 201 and created the account, POST /api/roles with an empty name returned 201, and a
 * 5000-character name produced a 500 — the string exceeded the column length and the database error
 * surfaced as an unhandled exception instead of a validation message.
 *
 * Every MaxLength below matches the HasMaxLength in AuthDbContext for that column. That is the whole
 * point: a value the API accepts must be a value the schema can store, or the check has just moved the
 * failure from a clean 400 to a 500.
 */

/// <summary>AuthProvider defaults "Local" and is immutable after creation (like RemoteApp.Key) — switching an existing account between Local and Google mid-life is a deliberately unsupported edge case for v1, avoiding a half-defined credential-transition flow.</summary>
public record CreateUserRequest(
    [Required(AllowEmptyStrings = false, ErrorMessage = "Name is required.")]
    [MaxLength(200, ErrorMessage = "Name cannot exceed 200 characters.")]
    string Name,

    [Required(AllowEmptyStrings = false, ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    [MaxLength(320, ErrorMessage = "Email cannot exceed 320 characters.")]
    string Email,

    // Required, and digit-bounded rather than only character-checked. The old rule accepted "1" and a
    // 40-digit string because it validated the alphabet but never how many digits were present.
    // E.164 caps a full international number at 15 digits and nothing under 7 is dialable; the shape
    // stays loose because +91 98765 43210, 098765-43210 and (022) 2222 3333 are all legitimate.
    [Required(AllowEmptyStrings = false, ErrorMessage = "Phone number is required.")]
    [MaxLength(32, ErrorMessage = "Phone number cannot exceed 32 characters.")]
    [RegularExpression(@"^(?=(?:\D*\d){7,15}\D*$)[0-9+()\-.\s]+$", ErrorMessage = "Enter a valid phone number (7-15 digits).")]
    string PhoneNumber,

    Guid? RoleId,
    bool IsActive = true,
    string AuthProvider = "Local");

/// <summary>Null for Google-provisioned accounts — there's no local password to hand back.</summary>
public record CreateUserResponse(UserDetailDto User, string? TemporaryPassword);

public record UpdateUserRequest(
    [Required(AllowEmptyStrings = false, ErrorMessage = "Name is required.")]
    [MaxLength(200, ErrorMessage = "Name cannot exceed 200 characters.")]
    string Name,

    [Required(AllowEmptyStrings = false, ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    [MaxLength(320, ErrorMessage = "Email cannot exceed 320 characters.")]
    string Email,

    // Required, and digit-bounded rather than only character-checked. The old rule accepted "1" and a
    // 40-digit string because it validated the alphabet but never how many digits were present.
    // E.164 caps a full international number at 15 digits and nothing under 7 is dialable; the shape
    // stays loose because +91 98765 43210, 098765-43210 and (022) 2222 3333 are all legitimate.
    [Required(AllowEmptyStrings = false, ErrorMessage = "Phone number is required.")]
    [MaxLength(32, ErrorMessage = "Phone number cannot exceed 32 characters.")]
    [RegularExpression(@"^(?=(?:\D*\d){7,15}\D*$)[0-9+()\-.\s]+$", ErrorMessage = "Enter a valid phone number (7-15 digits).")]
    string PhoneNumber,

    Guid? RoleId,

    /// <summary>
    /// Whether the account may sign in. Added because the edit form's "Account is Active" toggle had
    /// nothing to persist into — it moved, the form saved, and the status silently did not change.
    ///
    /// Defaults to true so an older client that omits the field cannot accidentally deactivate the
    /// account it is editing.
    /// </summary>
    bool IsActive = true);

public record UpdateUserStatusRequest(bool IsActive);

public record UpdateUserPermissionOverridesRequest(IReadOnlyList<PermissionOverrideDto> Overrides);
