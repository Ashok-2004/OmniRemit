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

/// <summary>AuthProvider defaults "Local" and is immutable after creation (like RemoteApp.Key) — switching an existing account between Local and Google mid-life is a deliberately unsupported edge case for v1, avoiding a half-defined credential-transition flow.</summary>
public record CreateUserRequest(string Name, string Email, string? PhoneNumber, Guid? RoleId, bool IsActive = true, string AuthProvider = "Local");

/// <summary>Null for Google-provisioned accounts — there's no local password to hand back.</summary>
public record CreateUserResponse(UserDetailDto User, string? TemporaryPassword);

public record UpdateUserRequest(string Name, string Email, string? PhoneNumber, Guid? RoleId);

public record UpdateUserStatusRequest(bool IsActive);

public record UpdateUserPermissionOverridesRequest(IReadOnlyList<PermissionOverrideDto> Overrides);
