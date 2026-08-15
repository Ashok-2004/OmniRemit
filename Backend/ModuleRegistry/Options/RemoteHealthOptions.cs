namespace ModuleRegistry.Options;

/// <summary>
/// Tuning for the background remote-app reachability probe. Every value is configurable rather than
/// hardcoded so a deployment with many remotes (or slow ones) can tune the sweep without a rebuild.
/// </summary>
public class RemoteHealthOptions
{
    public const string SectionName = "RemoteHealth";

    /// <summary>Set false to turn off background probing entirely (health then stays Unknown, which the host renders neutrally).</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>How long to wait after startup before the first sweep.</summary>
    public TimeSpan StartupDelay { get; set; } = TimeSpan.FromSeconds(10);

    /// <summary>How often to re-probe every registered app.</summary>
    public TimeSpan Interval { get; set; } = TimeSpan.FromSeconds(60);

    /// <summary>Per-request timeout when fetching a manifest. Short on purpose — a hung remote must not stall the sweep.</summary>
    public TimeSpan ProbeTimeout { get; set; } = TimeSpan.FromSeconds(5);
}
