using Microsoft.EntityFrameworkCore;
using ModuleRegistry.Domain.Enums;
using ModuleRegistry.Options;
using Microsoft.Extensions.Options;

namespace ModuleRegistry.Infrastructure;

/// <summary>
/// Periodically probes every non-Disabled remote app's manifest URL and records the real result.
/// <para>
/// This is what lets the host show an app as unavailable <em>before</em> a user clicks into it, and
/// what feeds the dashboard's system-health panel. Probes run concurrently with a short per-request
/// timeout so one hung remote cannot delay the rest of the sweep.
/// </para>
/// </summary>
public class RemoteAppHealthProbeService(
    IServiceProvider services,
    IOptions<RemoteHealthOptions> options,
    ILogger<RemoteAppHealthProbeService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var settings = options.Value;
        if (!settings.Enabled)
        {
            logger.LogInformation("Remote app health probing is disabled via configuration.");
            return;
        }

        // Let the app finish starting before the first sweep — the probe is a background nicety and
        // must never contend with startup migrations or the first real requests.
        try
        {
            await Task.Delay(settings.StartupDelay, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProbeAllAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // A failed sweep must never kill the background service — the next one may succeed.
                logger.LogError(ex, "Remote app health sweep failed; will retry on the next interval.");
            }

            try
            {
                await Task.Delay(settings.Interval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task ProbeAllAsync(CancellationToken ct)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ModuleRegistryDbContext>();
        var manifestClient = scope.ServiceProvider.GetRequiredService<RemoteManifestClient>();

        var apps = await db.RemoteApps
            .Where(a => a.Status != RemoteAppStatus.Disabled)
            .ToListAsync(ct);

        if (apps.Count == 0)
        {
            return;
        }

        // Concurrently, not sequentially: N unreachable remotes would otherwise cost N × timeout.
        var probes = apps.Select(async app =>
        {
            var result = await manifestClient.ProbeAsync(app.ManifestUrl, ct);
            return (app, result);
        });

        var results = await Task.WhenAll(probes);
        var now = DateTimeOffset.UtcNow;

        foreach (var (app, result) in results)
        {
            if (app.Health != result.Health)
            {
                logger.LogInformation(
                    "Remote app '{Key}' health changed {Previous} -> {Current}{Error}",
                    app.Key, app.Health, result.Health,
                    result.Error is null ? string.Empty : $" ({result.Error})");
            }

            app.Health = result.Health;
            app.LastHealthCheckAt = now;
            app.LastHealthError = result.Error;

            // Only overwrite the recorded container name on a successful probe — a transient outage
            // must not erase what we already know about the app.
            if (result.ContainerName is not null)
            {
                app.ContainerName = result.ContainerName;
            }
        }

        await db.SaveChangesAsync(ct);
    }
}
