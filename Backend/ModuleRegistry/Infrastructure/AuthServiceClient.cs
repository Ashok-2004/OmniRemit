using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using ModuleRegistry.Options;

namespace ModuleRegistry.Infrastructure;

/// <summary>
/// Pushes RemoteApp-sourced permission-feature changes into AuthService's catalog whenever an
/// admin creates, edits, removes, or bulk-resyncs remote apps here. AuthService's Role editor reads
/// its own PermissionFeatures table on every open — this push is what keeps that table caught up,
/// so the Role editor never has to call ModuleRegistry live on that hot path. See the plan's
/// "Permission-catalog sync mechanism" section for the full rationale.
///
/// Failures are logged, not thrown — a transient AuthService outage during a registry edit
/// shouldn't block the admin's edit here; POST /api/remote-apps/resync-permissions exists as the
/// manual recovery path once AuthService is back.
/// </summary>
public class AuthServiceClient(HttpClient httpClient, IOptions<AuthIntegrationOptions> options, ILogger<AuthServiceClient> logger)
{
    private readonly AuthIntegrationOptions _options = options.Value;

    private record UpsertFeatureRequest(string Key, string DisplayName, int SortOrder);
    private record DeactivateFeatureRequest(string Key);
    private record ResyncFeaturesRequest(IReadOnlyList<UpsertFeatureRequest> Features);

    public Task<bool> UpsertAsync(string featureKey, string displayName, int sortOrder, CancellationToken ct = default) =>
        PostAsync("internal/permission-features/upsert", new UpsertFeatureRequest(featureKey, displayName, sortOrder), ct);

    public Task<bool> DeactivateAsync(string featureKey, CancellationToken ct = default) =>
        PostAsync("internal/permission-features/deactivate", new DeactivateFeatureRequest(featureKey), ct);

    public Task<bool> ResyncAsync(IReadOnlyList<(string Key, string DisplayName, int SortOrder)> features, CancellationToken ct = default) =>
        PostAsync(
            "internal/permission-features/resync",
            new ResyncFeaturesRequest(features.Select(f => new UpsertFeatureRequest(f.Key, f.DisplayName, f.SortOrder)).ToList()),
            ct);

    private async Task<bool> PostAsync<TBody>(string path, TBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.BaseUrl))
        {
            logger.LogWarning("AuthService__BaseUrl is not configured — skipping permission-feature sync call to {Path}.", path);
            return false;
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{_options.BaseUrl.TrimEnd('/')}/{path}")
            {
                Content = JsonContent.Create(body),
            };
            request.Headers.Add("X-Internal-Api-Key", _options.InternalApiKey);

            var response = await httpClient.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "AuthService rejected permission-feature sync call to {Path}: {StatusCode}. Run resync-permissions once it's fixed.",
                    path, response.StatusCode);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to reach AuthService for permission-feature sync call to {Path}. Run resync-permissions once it's reachable.", path);
            return false;
        }
    }
}
