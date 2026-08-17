namespace ModuleRegistry.Domain;

/// <summary>
/// One capability a remote app declares, flattened with its owning sub-module.
/// <para>
/// Kept flat rather than nested because it maps 1:1 onto a <c>RemoteAppCapability</c> row, and the
/// nesting is only needed at the two ends — reading the remote's discovery endpoint and pushing to
/// AuthService — where it is grouped back up.
/// </para>
/// <para>
/// <see cref="ModuleKey"/> is empty for a remote still using the original flat contract, meaning the
/// capability belongs directly to the app rather than to a sub-module.
/// </para>
/// </summary>
public record RemoteCapability(string ModuleKey, string ModuleDisplayName, string Key, string DisplayName);
