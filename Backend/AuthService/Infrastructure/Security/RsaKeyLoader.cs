using System.Security.Cryptography;

namespace AuthService.Infrastructure.Security;

/// <summary>
/// Parses an RSA PEM key out of an env-var-safe encoding (literal "\n" instead of real newlines,
/// the common convention for putting multi-line PEM content in a single .env line).
/// </summary>
public static class RsaKeyLoader
{
    public static RSA LoadPrivateKey(string pem)
    {
        var rsa = RSA.Create();
        rsa.ImportFromPem(Normalize(pem));
        return rsa;
    }

    public static RSA LoadPublicKey(string pem)
    {
        var rsa = RSA.Create();
        rsa.ImportFromPem(Normalize(pem));
        return rsa;
    }

    private static string Normalize(string pem) => pem.Replace("\\n", "\n");
}
