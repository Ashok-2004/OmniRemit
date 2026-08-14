namespace AuthService.Application.DTOs;

public record LoginRequest(string Email, string Password);

public record CurrentUserDto(
    Guid Id,
    string Name,
    string Email,
    string? PhoneNumber,
    Guid? RoleId,
    string? RoleName,
    bool IsAdministrator,
    bool MustChangePassword,
    IReadOnlyList<string> Permissions);

public record LoginResponse(string AccessToken, DateTimeOffset ExpiresAt, CurrentUserDto User);

public record RefreshResponse(string AccessToken, DateTimeOffset ExpiresAt, CurrentUserDto User);
