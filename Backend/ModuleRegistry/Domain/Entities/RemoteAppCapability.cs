namespace ModuleRegistry.Domain.Entities;

/// <summary>
/// The last-known capability set fetched from a RemoteApp's PermissionsSourceUrl (or, if that's
/// unset, nothing — the app simply has no dynamically-declared capabilities beyond sidebar
/// visibility). Mirrors AuthDb's PermissionFeatureCapability — this is the local cache ModuleRegistry
/// pushes from; AuthService is still the actual source of truth the host reads at login.
/// </summary>
public class RemoteAppCapability
{
    public Guid Id { get; set; }

    public Guid RemoteAppId { get; set; }
    public RemoteApp? RemoteApp { get; set; }

    /// <summary>
    /// Sub-module this capability belongs to, e.g. "department". Empty string for a remote that
    /// still reports the old flat contract, which is treated as one implicit module.
    /// </summary>
    public string ModuleKey { get; set; } = string.Empty;

    /// <summary>Human label for the sub-module, e.g. "Department". Stored because no other hop carries it.</summary>
    public string ModuleDisplayName { get; set; } = string.Empty;

    public required string Key { get; set; }
    public required string DisplayName { get; set; }
    public int SortOrder { get; set; }
}
