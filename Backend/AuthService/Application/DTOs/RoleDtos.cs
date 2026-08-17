using System.ComponentModel.DataAnnotations;

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

/// <summary>
/// Lengths match Role.Name (100) and Role.Description (500) in AuthDbContext. An empty role name was
/// previously accepted and created a nameless role that then rendered as a blank row in every list.
/// </summary>
public record UpsertRoleRequest(
    [Required(AllowEmptyStrings = false, ErrorMessage = "Role name is required.")]
    [MaxLength(100, ErrorMessage = "Role name cannot exceed 100 characters.")]
    string Name,

    [MaxLength(500, ErrorMessage = "Description cannot exceed 500 characters.")]
    string? Description,

    bool IsAdministrator,
    IReadOnlyList<RolePermissionGrantDto> Permissions);

public record RoleUserDto(Guid Id, string Name, string Email);

/// <summary>
/// Users assigned to a role. <paramref name="Total"/> is the real full count even when
/// <paramref name="Items"/> is capped, so the UI can honestly say "showing 50 of 4,312" rather than
/// implying the role has only 50 members.
/// </summary>
public record RoleUsersDto(IReadOnlyList<RoleUserDto> Items, int Total);
