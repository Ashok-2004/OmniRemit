namespace AuthService.Application.DTOs;

public record RoleListItemDto(
    Guid Id,
    string Name,
    string? Description,
    bool IsSystemRole,
    bool IsAdministrator,
    int UsersCount,
    int PermissionsCount,
    DateTimeOffset CreatedAt);

public record RolePermissionGrantDto(string FeatureKey, string Capability);

public record RoleDetailDto(
    Guid Id,
    string Name,
    string? Description,
    bool IsSystemRole,
    bool IsAdministrator,
    IReadOnlyList<RolePermissionGrantDto> Permissions,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record UpsertRoleRequest(string Name, string? Description, bool IsAdministrator, IReadOnlyList<RolePermissionGrantDto> Permissions);

public record RoleUserDto(Guid Id, string Name, string Email);
