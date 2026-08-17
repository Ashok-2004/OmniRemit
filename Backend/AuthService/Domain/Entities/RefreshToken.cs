namespace AuthService.Domain.Entities;

/// <summary>
/// Backing store for the httpOnly refresh cookie. Only a hash of the token is stored (never the
/// raw value) so a DB leak alone can't be used to mint sessions. Rotated on every refresh —
/// ReplacedByTokenId lets a reuse-detection check flag token theft.
/// </summary>
public class RefreshToken
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public User? User { get; set; }

    public required string TokenHash { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }

    /// <summary>
    /// Hard end of the whole sign-in session, set once at login and copied forward unchanged through
    /// every rotation.
    /// <para>
    /// Without this a session slid forever: each rotation issued a brand-new token with a fresh full
    /// <c>RefreshTokenDays</c> window, so a client that refreshed periodically stayed authenticated
    /// indefinitely and no amount of elapsed time ever forced a re-login.
    /// </para>
    /// <para>
    /// Stored as an absolute instant rather than a session-start marker so <see cref="ExpiresAt"/>
    /// remains the single authority on validity — it is clamped to never exceed this value, which
    /// means the existing expiry check keeps working untouched.
    /// </para>
    /// </summary>
    public DateTimeOffset AbsoluteExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public Guid? ReplacedByTokenId { get; set; }
    public string? CreatedByIp { get; set; }

    public bool IsActive => RevokedAt is null && ExpiresAt > DateTimeOffset.UtcNow;
}
