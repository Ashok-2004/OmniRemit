namespace ModuleRegistry.Domain.Enums;

public enum RemoteAppStatus
{
    /// <summary>Loads normally for anyone with View access to its permission feature.</summary>
    Active = 0,

    /// <summary>Stays in the sidebar but the host shows MaintenanceMessage instead of loading the remote.</summary>
    Maintenance = 1,

    /// <summary>Excluded from the sidebar and unroutable entirely. Permission grants on it are untouched so re-enabling needs no re-configuration.</summary>
    Disabled = 2,
}
