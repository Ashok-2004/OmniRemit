namespace AuthService.Infrastructure.Security;

/// <summary>
/// Marks the small allow-list of endpoints a user still holding a forced temporary password may
/// call — the ones they need in order to stop holding it. Everything else in AuthService is
/// refused by MustChangePasswordFilter. Purely a marker; the filter reads it off the endpoint
/// metadata.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class AllowWhenPasswordChangeRequiredAttribute : Attribute;
