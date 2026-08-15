namespace AuthService.Domain.Enums;

/// <summary>How a user authenticates. Google accounts have no PasswordHash and can never sign in with a local password — see AuthAppService.LoginAsync.</summary>
public enum AuthProvider
{
    Local = 0,
    Google = 1,
}
