using AuthService.Application.DTOs;
using AuthService.Domain.Entities;
using AuthService.Domain.Enums;
using AuthService.Infrastructure;
using AuthService.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Application.Services;

public class InvalidCredentialsException() : Exception("Invalid email or password.");
public class AccountInactiveException() : Exception("This account is inactive. Contact an administrator.");
public class InvalidRefreshTokenException() : Exception("Refresh session is invalid or has expired.");

public record AuthResult(string AccessToken, DateTimeOffset ExpiresAt, string RefreshToken, DateTimeOffset RefreshExpiresAt, CurrentUserDto User);

public class AuthAppService(
    AuthDbContext db,
    PasswordHasher passwordHasher,
    JwtTokenService jwtTokenService,
    RefreshTokenService refreshTokenService,
    PermissionClaimsBuilder permissionClaimsBuilder)
{
    public async Task<AuthResult> LoginAsync(string email, string password, string? clientIp, CancellationToken ct = default)
    {
        var user = await db.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Email == email.Trim().ToLowerInvariant(), ct);

        if (user is null || !passwordHasher.Verify(user, user.PasswordHash, password))
        {
            throw new InvalidCredentialsException();
        }

        if (user.Status != UserStatus.Active)
        {
            throw new AccountInactiveException();
        }

        user.LastLoginAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        return await IssueSessionAsync(user, clientIp, ct);
    }

    public async Task<AuthResult> RefreshAsync(string rawRefreshToken, string? clientIp, CancellationToken ct = default)
    {
        var rotated = await refreshTokenService.RotateAsync(rawRefreshToken, clientIp, ct);
        if (rotated is null)
        {
            throw new InvalidRefreshTokenException();
        }

        var (user, newToken) = rotated.Value;
        if (user.Status != UserStatus.Active)
        {
            throw new AccountInactiveException();
        }

        var permissions = await permissionClaimsBuilder.BuildAsync(user, ct);
        var access = jwtTokenService.CreateAccessToken(user, permissions);

        return new AuthResult(
            access.Token,
            access.ExpiresAt,
            newToken.RawToken,
            newToken.ExpiresAt,
            ToCurrentUserDto(user, permissions));
    }

    public Task LogoutAsync(string rawRefreshToken, CancellationToken ct = default) =>
        refreshTokenService.RevokeAsync(rawRefreshToken, ct);

    public async Task<CurrentUserDto?> GetCurrentUserAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            return null;
        }

        var permissions = await permissionClaimsBuilder.BuildAsync(user, ct);
        return ToCurrentUserDto(user, permissions);
    }

    private async Task<AuthResult> IssueSessionAsync(User user, string? clientIp, CancellationToken ct)
    {
        var permissions = await permissionClaimsBuilder.BuildAsync(user, ct);
        var access = jwtTokenService.CreateAccessToken(user, permissions);
        var refresh = await refreshTokenService.IssueAsync(user.Id, clientIp, ct);

        return new AuthResult(
            access.Token,
            access.ExpiresAt,
            refresh.RawToken,
            refresh.ExpiresAt,
            ToCurrentUserDto(user, permissions));
    }

    private static CurrentUserDto ToCurrentUserDto(User user, PermissionClaimsResult permissions) => new(
        user.Id,
        user.Name,
        user.Email,
        user.PhoneNumber,
        user.RoleId,
        user.Role?.Name,
        permissions.IsAdministrator,
        user.MustChangePassword,
        permissions.Permissions);
}
