namespace AuthService.Options;

/// <summary>
/// Bound from the "Security" config section. Holds the static AES-256 key used to protect
/// short-lived secrets that must survive a round trip through the database — today only the
/// one-time temporary password attached to an approved Create-User request.
///
/// A static key in .env, deliberately NOT ASP.NET DataProtection: these services run
/// containerized with ephemeral filesystems, so DataProtection's default key ring is regenerated
/// on every restart and any ciphertext written before the restart becomes permanently
/// undecryptable. A static key, read the same way Jwt__SigningKeyPrivate and Internal__ApiKey
/// already are, is the same trust model with none of the extra moving parts.
/// </summary>
public class SecretProtectionOptions
{
    public const string SectionName = "Security";

    /// <summary>Base64-encoded 32 raw bytes (AES-256). Empty means secret protection is
    /// unconfigured and any operation that needs it fails closed with a clear message.</summary>
    public string TempPasswordKey { get; set; } = string.Empty;
}
