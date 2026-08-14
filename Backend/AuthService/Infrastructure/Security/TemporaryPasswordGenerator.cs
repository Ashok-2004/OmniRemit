using System.Security.Cryptography;

namespace AuthService.Infrastructure.Security;

/// <summary>
/// Generates a random, sufficiently-strong temporary password for newly created accounts
/// (returned once in the create-user response; MustChangePassword forces a real one on first login).
/// </summary>
public static class TemporaryPasswordGenerator
{
    private const string Upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O to avoid visual ambiguity
    private const string Lower = "abcdefghijkmnpqrstuvwxyz";
    private const string Digits = "23456789";
    private const string Symbols = "!@#$%*?";
    private const string All = Upper + Lower + Digits + Symbols;

    public static string Generate(int length = 14)
    {
        Span<char> chars = stackalloc char[length];
        chars[0] = Pick(Upper);
        chars[1] = Pick(Lower);
        chars[2] = Pick(Digits);
        chars[3] = Pick(Symbols);

        for (var i = 4; i < length; i++)
        {
            chars[i] = Pick(All);
        }

        Shuffle(chars);
        return new string(chars);
    }

    private static char Pick(string alphabet) => alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];

    private static void Shuffle(Span<char> chars)
    {
        for (var i = chars.Length - 1; i > 0; i--)
        {
            var j = RandomNumberGenerator.GetInt32(i + 1);
            (chars[i], chars[j]) = (chars[j], chars[i]);
        }
    }
}
