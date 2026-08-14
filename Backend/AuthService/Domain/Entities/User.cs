using AuthService.Domain.Enums;

namespace AuthService.Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string Email { get; set; }
    public string? PhoneNumber { get; set; }
    public required string PasswordHash { get; set; }
    public UserStatus Status { get; set; } = UserStatus.Active;

    /// <summary>
    /// Soft-delete flag, distinct from Status. Status toggles sign-in ability (the Active switch in
    /// Setup &gt; User) while still listing the account; IsDeleted removes it from listings entirely
    /// (the row is kept, never hard-deleted, so audit/FK history stays intact).
    /// </summary>
    public bool IsDeleted { get; set; }

    /// <summary>Single role per user (v1) — matches the platform's one-Role-column user table. Fine-tuning happens via UserPermissionOverride.</summary>
    public Guid? RoleId { get; set; }
    public Role? Role { get; set; }

    /// <summary>Forces a password change on next login — used for system-generated temporary passwords.</summary>
    public bool MustChangePassword { get; set; }

    public DateTimeOffset? LastLoginAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public ICollection<UserPermissionOverride> PermissionOverrides { get; set; } = new List<UserPermissionOverride>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
