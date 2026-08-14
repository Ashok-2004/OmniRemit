namespace AuthService.Domain.Entities;

/// <summary>
/// A named bundle of permissions. Roles are entirely admin-authored through Setup &gt; Role —
/// the six seeded here (Super Admin, Admin, Manager, Agent, Normal User, Read Only User) are just
/// a starting catalog, not a hardcoded enum; the frontend always renders whatever this table holds.
/// </summary>
public class Role
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }

    /// <summary>System roles (seeded at bootstrap) cannot be deleted, but their permissions can still be edited.</summary>
    public bool IsSystemRole { get; set; }

    /// <summary>
    /// Unrestricted-access flag ("Administrator Access" toggle in Setup &gt; Role). When true, every
    /// user with this role bypasses the RolePermission matrix entirely and is granted every
    /// capability on every active feature, including ones added after this role was created.
    /// </summary>
    public bool IsAdministrator { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}
