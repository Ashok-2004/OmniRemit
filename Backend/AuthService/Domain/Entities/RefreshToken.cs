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
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public Guid? ReplacedByTokenId { get; set; }
    public string? CreatedByIp { get; set; }

    public bool IsActive => RevokedAt is null && ExpiresAt > DateTimeOffset.UtcNow;
}
