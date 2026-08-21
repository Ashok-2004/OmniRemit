using System.Security.Cryptography;
using System.Text;
using AuthService.Options;
using Microsoft.Extensions.Options;

namespace AuthService.Infrastructure.Security;

/// <summary>
/// Authenticated encryption for the small number of secrets this service must hand back to a
/// human LATER rather than immediately — today only the temporary password produced when a
/// gated Create-User request is approved, which has to survive between the checker's Approve
/// click and the maker's one-time reveal.
///
/// AES-256-GCM, not ASP.NET DataProtection: GCM authenticates the ciphertext, so a tampered or
/// truncated column value fails to decrypt outright instead of yielding garbage that would then
/// be shown to a human as a password. See SecretProtectionOptions' doc comment for why
/// DataProtection's ephemeral key ring is a poor fit for a containerized deployment.
///
/// Wire format is a single base64 string: nonce (12) || tag (16) || ciphertext (n). One column,
/// no separate nonce column — the two fixed-size prefixes are sliced off by length.
/// </summary>
public class SecretProtector(IOptions<SecretProtectionOptions> options)
{
    private const int NonceSize = 12;
    private const int TagSize = 16;
    private const int KeySize = 32;

    /// <summary>True when a usable key is configured. Callers about to perform an irreversible
    /// action which will PRODUCE a secret should check this first and refuse up front, rather
    /// than applying the change and then discovering the secret cannot be stored.</summary>
    public bool IsConfigured => TryGetKey(out _);

    public string Protect(string plaintext)
    {
        if (!TryGetKey(out var key))
        {
            throw new InvalidOperationException(
                "Security:TempPasswordKey is not configured (or is not 32 base64-encoded bytes) — " +
                "set Security__TempPasswordKey in Backend/AuthService/.env.");
        }

        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
        var output = new byte[NonceSize + TagSize + plaintextBytes.Length];
        var nonce = output.AsSpan(0, NonceSize);
        var tag = output.AsSpan(NonceSize, TagSize);
        var ciphertext = output.AsSpan(NonceSize + TagSize);

        RandomNumberGenerator.Fill(nonce);
        using (var aes = new AesGcm(key, TagSize))
        {
            aes.Encrypt(nonce, plaintextBytes, ciphertext, tag);
        }

        CryptographicOperations.ZeroMemory(plaintextBytes);
        return Convert.ToBase64String(output);
    }

    /// <summary>Returns null for anything that is not a valid, authentic ciphertext under the
    /// current key — a truncated column, a value written under a rotated key, or tampering. Null
    /// is deliberately the single "not recoverable" signal; callers don't need to distinguish
    /// why.</summary>
    public string? Unprotect(string? protectedValue)
    {
        if (string.IsNullOrWhiteSpace(protectedValue) || !TryGetKey(out var key))
        {
            return null;
        }

        byte[] input;
        try
        {
            input = Convert.FromBase64String(protectedValue);
        }
        catch (FormatException)
        {
            return null;
        }

        if (input.Length < NonceSize + TagSize)
        {
            return null;
        }

        var plaintext = new byte[input.Length - NonceSize - TagSize];
        try
        {
            using var aes = new AesGcm(key, TagSize);
            aes.Decrypt(
                input.AsSpan(0, NonceSize),
                input.AsSpan(NonceSize + TagSize),
                input.AsSpan(NonceSize, TagSize),
                plaintext);
        }
        catch (CryptographicException)
        {
            return null;
        }

        var result = Encoding.UTF8.GetString(plaintext);
        CryptographicOperations.ZeroMemory(plaintext);
        return result;
    }

    /// <summary>Decoded lazily rather than cached at construction: an unconfigured key must not
    /// stop the DI container constructing every service that transitively depends on this one.</summary>
    private bool TryGetKey(out byte[] key)
    {
        key = [];
        var configured = options.Value.TempPasswordKey;
        if (string.IsNullOrWhiteSpace(configured))
        {
            return false;
        }

        Span<byte> buffer = stackalloc byte[KeySize];
        if (!Convert.TryFromBase64String(configured.Trim(), buffer, out var written) || written != KeySize)
        {
            return false;
        }

        key = buffer.ToArray();
        return true;
    }
}
