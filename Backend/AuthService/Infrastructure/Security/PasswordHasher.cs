using AuthService.Domain.Entities;
using Microsoft.AspNetCore.Identity;

namespace AuthService.Infrastructure.Security;

/// <summary>
/// Thin wrapper around ASP.NET Core Identity's PBKDF2-based PasswordHasher&lt;TUser&gt; — reuses a
/// battle-tested, iteration-count-upgradeable hashing implementation instead of hand-rolling one.
/// </summary>
public class PasswordHasher
{
    private readonly PasswordHasher<User> _inner = new();

    public string Hash(User user, string plainTextPassword) => _inner.HashPassword(user, plainTextPassword);

    public bool Verify(User user, string hash, string plainTextPassword)
    {
        var result = _inner.VerifyHashedPassword(user, hash, plainTextPassword);
        return result is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
    }
}
