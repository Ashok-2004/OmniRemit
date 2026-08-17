namespace AuthService.Options;

/// <summary>
/// Tuning for the background sweep that deletes dead refresh tokens.
/// <para>
/// The table grows by one row per login AND one per rotation — roughly 96 rows per active user per
/// day at a 15-minute access token — and nothing ever removed them. Every value is configurable
/// rather than hardcoded so a deployment with a long retention requirement can tune it without a
/// rebuild.
/// </para>
/// </summary>
public class RefreshTokenCleanupOptions
{
    public const string SectionName = "RefreshTokenCleanup";

    /// <summary>Set false to disable the sweep entirely (the table then grows unbounded, as before).</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Delay before the first sweep, so cleanup never contends with startup migrations and seeding.</summary>
    public TimeSpan StartupDelay { get; set; } = TimeSpan.FromMinutes(2);

    /// <summary>How often to sweep. Hourly is ample — this is housekeeping, not a hot path.</summary>
    public TimeSpan Interval { get; set; } = TimeSpan.FromHours(1);

    /// <summary>
    /// How long a dead token is kept after it expires. Non-zero on purpose: revoked rows are the only
    /// evidence of a token-reuse (theft) event, so they are worth retaining for a while after the
    /// fact rather than deleted the instant they stop being usable.
    /// </summary>
    public TimeSpan Retention { get; set; } = TimeSpan.FromDays(7);

    /// <summary>Maximum rows removed per sweep, so a first run against a long-neglected table cannot issue one enormous DELETE.</summary>
    public int BatchSize { get; set; } = 5_000;
}
