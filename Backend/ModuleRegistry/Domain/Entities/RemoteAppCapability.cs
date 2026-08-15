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

    public required string Key { get; set; }
    public required string DisplayName { get; set; }
    public int SortOrder { get; set; }
}
