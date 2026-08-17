namespace AuthService.Application.DTOs;

public record LoginRequest(string Email, string Password);

/// <summary>ID token from Google's Identity Services JS SDK — verified server-side via Google.Apis.Auth, never trusted as-is.</summary>
public record GoogleLoginRequest(string IdToken);

/// <summary>Public, non-secret config the frontend reads instead of hardcoding whether Google Sign-In is available or which domains it accepts.</summary>
public record SsoConfigDto(bool GoogleEnabled, IReadOnlyList<string> AllowedDomains);

public record CurrentUserDto(
    Guid Id,
    string Name,
    string Email,
    string? PhoneNumber,
    Guid? RoleId,
    string? RoleName,
    bool IsAdministrator,
    bool MustChangePassword,
    IReadOnlyList<string> Permissions,
    string AuthProvider,
    bool IsActive,
    DateTimeOffset? LastLoginAt);

public record LoginResponse(string AccessToken, DateTimeOffset ExpiresAt, CurrentUserDto User);

public record RefreshResponse(string AccessToken, DateTimeOffset ExpiresAt, CurrentUserDto User);

/// <summary>
/// A user changing their OWN password. Deliberately carries no user id: the account acted upon comes
/// from the caller's authenticated token, never the request body. Accepting an id here would let any
/// authenticated user set any other user's password.
/// </summary>
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

/// <param name="SessionsEnded">Other sessions signed out as a result, so the UI can say so.</param>
public record ChangePasswordResponse(string Message, int SessionsEnded);

/// <summary>
/// The password rules this deployment enforces, so the frontend can display them rather than keeping
/// its own copy that can drift. <paramref name="Description"/> is generated from the options
/// themselves, so it cannot disagree with what Validate() actually checks.
/// </summary>
public record PasswordPolicyDto(
    int MinimumLength,
    int MaximumLength,
    bool RequireUppercase,
    bool RequireLowercase,
    bool RequireDigit,
    bool RequireNonAlphanumeric,
    string Description);
