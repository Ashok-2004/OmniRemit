namespace AuthService.Infrastructure.Security;

/// <summary>The effective permission set embedded into a user's access token at login/refresh time.</summary>
/// <param name="IsAdministrator">True when the user's role has the unrestricted-access flag set — bypasses <paramref name="Permissions"/> entirely.</param>
/// <param name="Permissions">"featureKey:Capability" strings — role grants unioned with user overrides, minus revokes, active features only.</param>
public record PermissionClaimsResult(bool IsAdministrator, IReadOnlyList<string> Permissions);
