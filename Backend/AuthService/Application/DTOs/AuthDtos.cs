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
