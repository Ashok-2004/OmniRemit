namespace AuthService.Domain.Enums;

/// <summary>Account status. Inactive users cannot sign in — mirrors the "Active" toggle in Setup &gt; User.</summary>
public enum UserStatus
{
    Active = 0,
    Inactive = 1,
}
