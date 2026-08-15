using AuthService.Application.DTOs;
using AuthService.Domain.Entities;
using AuthService.Domain.Enums;
using AuthService.Infrastructure;
using AuthService.Infrastructure.Security;
using AuthService.Options;
using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AuthService.Application.Services;

public class InvalidCredentialsException() : Exception("Invalid email or password.");
public class AccountInactiveException() : Exception("This account is inactive. Contact an administrator.");
public class InvalidRefreshTokenException() : Exception("Refresh session is invalid or has expired.");
public class SsoNotConfiguredException() : Exception("Google Sign-In is not configured for this deployment.");
public class SsoDomainNotAllowedException(string domain) : Exception($"The domain '{domain}' is not allowed to sign in via Google.");
public class SsoAccountNotFoundException() : Exception("No active account is provisioned for this Google identity. Ask an administrator to create one.");

public record AuthResult(string AccessToken, DateTimeOffset ExpiresAt, string RefreshToken, DateTimeOffset RefreshExpiresAt, CurrentUserDto User);

public class AuthAppService(
    AuthDbContext db,
    PasswordHasher passwordHasher,
    JwtTokenService jwtTokenService,
    RefreshTokenService refreshTokenService,
    PermissionClaimsBuilder permissionClaimsBuilder,
    AuditLogAppService auditLog,
    IOptions<GoogleAuthOptions> googleOptions)
{
    private const string ServiceName = "AuthService";
    private readonly GoogleAuthOptions _google = googleOptions.Value;

    public async Task<AuthResult> LoginAsync(string email, string password, string? clientIp, string? userAgent, CancellationToken ct = default)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await db.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail, ct);

        // A Google-provisioned account has no PasswordHash at all — it can never satisfy a local
        // password check, so this falls through to the same InvalidCredentialsException as a wrong
        // password would. Deliberately not distinguished in the response (don't leak account
        // existence/type to an unauthenticated caller); FailureReason on the audit row is internal only.
        if (user is null || user.PasswordHash is null || !passwordHasher.Verify(user, user.PasswordHash, password))
        {
            await LogLoginFailureAsync(normalizedEmail, user, "Invalid email or password.", clientIp, userAgent, "Local", ct);
            throw new InvalidCredentialsException();
        }

        if (user.Status != UserStatus.Active)
        {
            await LogLoginFailureAsync(normalizedEmail, user, "Account is inactive.", clientIp, userAgent, "Local", ct);
            throw new AccountInactiveException();
        }

        user.LastLoginAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var result = await IssueSessionAsync(user, clientIp, ct);

        await auditLog.WriteAsync(
            ServiceName, user.Id, user.Name, "auth.login_succeeded", "User", user.Id.ToString(),
            $"{user.Email} signed in.", clientIp, authMethod: "Local", userAgent: userAgent, ct: ct);

        return result;
    }

    /// <summary>
    /// Verifies a real Google ID token (cryptographic signature check against Google's own public
    /// keys via Google.Apis.Auth — never a fabricated check), confirms the email's domain is
    /// allow-listed, then signs in an ALREADY-PROVISIONED User row with AuthProvider=Google. SSO
    /// never auto-creates an account — an administrator still creates the User first (same
    /// UserAppService.CreateAsync flow as a Local account), just with AuthProvider=Google and no
    /// password.
    /// </summary>
    public async Task<AuthResult> GoogleLoginAsync(string idToken, string? clientIp, string? userAgent, CancellationToken ct = default)
    {
        if (!_google.IsConfigured)
        {
            throw new SsoNotConfiguredException();
        }

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(idToken, new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = [_google.ClientId],
            });
        }
        catch (InvalidJwtException)
        {
            await LogLoginFailureAsync("unknown", null, "Invalid or expired Google ID token.", clientIp, userAgent, "Google", ct);
            throw new InvalidCredentialsException();
        }

        var email = payload.Email.Trim().ToLowerInvariant();
        var domain = email.Contains('@') ? email[(email.IndexOf('@') + 1)..] : string.Empty;

        if (!_google.AllowedDomainsList.Contains(domain, StringComparer.OrdinalIgnoreCase))
        {
            await LogLoginFailureAsync(email, null, $"Domain '{domain}' is not in the allowed list.", clientIp, userAgent, "Google", ct);
            throw new SsoDomainNotAllowedException(domain);
        }

        var user = await db.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Email == email && u.AuthProvider == AuthProvider.Google, ct);

        if (user is null)
        {
            await LogLoginFailureAsync(email, null, "No Google-provisioned account exists for this email.", clientIp, userAgent, "Google", ct);
            throw new SsoAccountNotFoundException();
        }

        if (user.Status != UserStatus.Active)
        {
            await LogLoginFailureAsync(email, user, "Account is inactive.", clientIp, userAgent, "Google", ct);
            throw new AccountInactiveException();
        }

        user.LastLoginAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var result = await IssueSessionAsync(user, clientIp, ct);

        await auditLog.WriteAsync(
            ServiceName, user.Id, user.Name, "auth.login_succeeded", "User", user.Id.ToString(),
            $"{user.Email} signed in via Google.", clientIp, authMethod: "Google", userAgent: userAgent, ct: ct);

        return result;
    }

    public SsoConfigDto GetSsoConfig() => new(_google.IsConfigured, _google.IsConfigured ? _google.AllowedDomainsList : []);

    /// <summary>
    /// Every real failure path lands here — invalid credentials, inactive accounts, and every
    /// Google SSO rejection reason. ActorName falls back to the attempted email when no matching
    /// user exists, so the trail still shows who tried even for a login that never resolved to a
    /// real account — never a fabricated name.
    /// </summary>
    private Task LogLoginFailureAsync(string attemptedEmail, User? user, string failureReason, string? clientIp, string? userAgent, string authMethod, CancellationToken ct) =>
        auditLog.WriteAsync(
            ServiceName, user?.Id, user?.Name ?? attemptedEmail, "auth.login_failed", "User", user?.Id.ToString(),
            $"Sign-in failed for {attemptedEmail}: {failureReason}", clientIp,
            authMethod: authMethod, result: "Failure", userAgent: userAgent, failureReason: failureReason, ct: ct);

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
        // Read-only path (GET /api/auth/me) — no need for change tracking.
        var user = await db.Users.AsNoTracking().Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == userId, ct);
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
        permissions.Permissions,
        user.AuthProvider.ToString(),
        user.Status == UserStatus.Active,
        user.LastLoginAt);
}
