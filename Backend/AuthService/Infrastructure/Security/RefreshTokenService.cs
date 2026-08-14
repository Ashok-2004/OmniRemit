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

    public async Task<IssuedRefreshToken> IssueAsync(Guid userId, string? createdByIp, CancellationToken ct = default)
    {
        var raw = GenerateRawToken();
        var expiresAt = DateTimeOffset.UtcNow.AddDays(_jwtOptions.RefreshTokenDays);

        db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = Hash(raw),
            ExpiresAt = expiresAt,
            CreatedAt = DateTimeOffset.UtcNow,
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

        var next = await IssueAsync(existing.UserId, createdByIp, ct);
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
