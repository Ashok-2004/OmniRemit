using System.Security.Cryptography;
using AuthService.Domain.Entities;
using AuthService.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AuthService.Infrastructure.Security;

public record IssuedRefreshToken(string RawToken, DateTimeOffset ExpiresAt);

/// <summary>
/// Manages the refresh-token lifecycle backing the httpOnly cookie: issue, rotate-on-use, and
/// reuse detection. Only a SHA-256 hash of the raw token is ever persisted — the raw value exists
/// only in the cookie sent to the browser and is never written to logs or the database.
/// </summary>
public class RefreshTokenService(AuthDbContext db, IOptions<JwtOptions> jwtOptions)
{
    private readonly JwtOptions _jwtOptions = jwtOptions.Value;

    /// <summary>
    /// Issues a refresh token. Pass <paramref name="parent"/> when rotating so the session's absolute
    /// deadline is inherited; omit it for a fresh sign-in, which starts a new deadline.
    /// </summary>
    public async Task<IssuedRefreshToken> IssueAsync(
        Guid userId,
        string? createdByIp,
        RefreshToken? parent = null,
        CancellationToken ct = default)
    {
        var raw = GenerateRawToken();
        var now = DateTimeOffset.UtcNow;

        // Inherit the session deadline on rotation; start a new one on a fresh login. A configured 0
        // disables the cap, in which case the deadline is pushed far enough out to never bind.
        var absoluteExpiresAt = parent?.AbsoluteExpiresAt
            ?? (_jwtOptions.AbsoluteSessionHours > 0
                ? now.AddHours(_jwtOptions.AbsoluteSessionHours)
                : DateTimeOffset.MaxValue);

        // Clamp so ExpiresAt stays the single authority on validity — the existing expiry check in
        // RotateAsync then enforces the cap for free, and a token can never outlive its session.
        var slidingExpiresAt = now.AddDays(_jwtOptions.RefreshTokenDays);
        var expiresAt = slidingExpiresAt < absoluteExpiresAt ? slidingExpiresAt : absoluteExpiresAt;

        db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = Hash(raw),
            ExpiresAt = expiresAt,
            AbsoluteExpiresAt = absoluteExpiresAt,
            CreatedAt = now,
            CreatedByIp = createdByIp,
        });
        await db.SaveChangesAsync(ct);

        return new IssuedRefreshToken(raw, expiresAt);
    }

    /// <summary>
    /// Validates the raw token from the cookie, rotates it (revokes the old row, issues a new one),
    /// and returns the owning user + the new raw token to set as the replacement cookie. Returns
    /// null if the token is unknown/expired. If a token that was already revoked is presented again
    /// (a strong signal of token theft/reuse), every active refresh token for that user is revoked
    /// as a precaution.
    /// </summary>
    public async Task<(User User, IssuedRefreshToken NewToken)?> RotateAsync(string rawToken, string? createdByIp, CancellationToken ct = default)
    {
        var hash = Hash(rawToken);
        var existing = await db.RefreshTokens
            .Include(t => t.User)
            .ThenInclude(u => u!.Role)
            .FirstOrDefaultAsync(t => t.TokenHash == hash, ct);

        if (existing is null)
        {
            return null;
        }

        if (existing.RevokedAt is not null)
        {
            await RevokeAllForUserAsync(existing.UserId, ct);
            return null;
        }

        if (existing.ExpiresAt <= DateTimeOffset.UtcNow || existing.User is null)
        {
            return null;
        }

        // The session's hard deadline. ExpiresAt is already clamped to never exceed this, so the
        // check above normally catches it first — this is belt-and-braces for rows written before
        // the cap existed, whose ExpiresAt was not clamped.
        if (existing.AbsoluteExpiresAt <= DateTimeOffset.UtcNow)
        {
            return null;
        }

        var next = await IssueAsync(existing.UserId, createdByIp, existing, ct);
        var newTokenEntity = await db.RefreshTokens.FirstAsync(t => t.TokenHash == Hash(next.RawToken), ct);

        existing.RevokedAt = DateTimeOffset.UtcNow;
        existing.ReplacedByTokenId = newTokenEntity.Id;
        await db.SaveChangesAsync(ct);

        return (existing.User, next);
    }

    public async Task RevokeAsync(string rawToken, CancellationToken ct = default)
    {
        var hash = Hash(rawToken);
        var existing = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (existing is not null && existing.RevokedAt is null)
        {
            existing.RevokedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
        }
    }

    /// <summary>
    /// Revokes every active session for a user except the one presenting <paramref name="keepRawToken"/>.
    ///
    /// Used after a password change. Changing a password has to evict sessions established with the
    /// OLD password — otherwise a user who changes their password because they believe it was stolen
    /// leaves the thief logged in indefinitely, since the attacker's refresh token keeps rotating on
    /// its own. The caller's current session is spared so they are not immediately signed out of the
    /// tab they just used.
    ///
    /// Returns the number of sessions ended, for the audit record.
    /// </summary>
    public async Task<int> RevokeAllForUserExceptAsync(Guid userId, string? keepRawToken, CancellationToken ct = default)
    {
        var keepHash = keepRawToken is null ? null : Hash(keepRawToken);

        var doomed = await db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null && (keepHash == null || t.TokenHash != keepHash))
            .ToListAsync(ct);

        foreach (var token in doomed)
        {
            token.RevokedAt = DateTimeOffset.UtcNow;
        }

        if (doomed.Count > 0)
        {
            await db.SaveChangesAsync(ct);
        }

        return doomed.Count;
    }

    private async Task RevokeAllForUserAsync(Guid userId, CancellationToken ct)
    {
        var active = await db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ToListAsync(ct);

        foreach (var token in active)
        {
            token.RevokedAt = DateTimeOffset.UtcNow;
        }

        if (active.Count > 0)
        {
            await db.SaveChangesAsync(ct);
        }
    }

    private static string GenerateRawToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64))
        .Replace('+', '-').Replace('/', '_').TrimEnd('=');

    private static string Hash(string rawToken)
    {
        var bytes = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToHexString(bytes);
    }
}
