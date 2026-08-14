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
    DateTimeOffset? LastLoginAt);

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
    IReadOnlyList<PermissionOverrideDto> PermissionOverrides);

public record CreateUserRequest(string Name, string Email, string? PhoneNumber, Guid? RoleId, bool IsActive = true);

public record CreateUserResponse(UserDetailDto User, string TemporaryPassword);

public record UpdateUserRequest(string Name, string Email, string? PhoneNumber, Guid? RoleId);

public record UpdateUserStatusRequest(bool IsActive);

public record UpdateUserPermissionOverridesRequest(IReadOnlyList<PermissionOverrideDto> Overrides);
