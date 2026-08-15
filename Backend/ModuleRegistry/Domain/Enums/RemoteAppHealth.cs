namespace ModuleRegistry.Domain.Enums;

/// <summary>
/// Result of the most recent reachability probe against a remote app's ManifestUrl.
/// <para>
/// Deliberately three-valued rather than a bool: <see cref="Unknown"/> is a real, distinct state
/// meaning "we have not probed this app yet" (freshly registered, or the probe service has not
/// completed its first pass). Collapsing it into <see cref="Unreachable"/> would make the host show
/// a red "down" badge for an app that is very likely fine, which is exactly the kind of fabricated
/// signal this codebase avoids — an unknown health is reported as unknown.
/// </para>
/// </summary>
public enum RemoteAppHealth
{
    /// <summary>Never probed, or the last probe was inconclusive. The host renders this neutrally, not as a failure.</summary>
    Unknown = 0,

    /// <summary>The manifest URL responded with a success status and parseable Module Federation manifest JSON.</summary>
    Healthy = 1,

    /// <summary>The manifest URL could not be fetched (connection refused, DNS failure, timeout) or did not return a usable manifest.</summary>
    Unreachable = 2,
}
