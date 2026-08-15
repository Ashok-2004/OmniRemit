using System.Text.Json.Serialization;
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
/// Also doubles as the client for two unrelated-but-adjacent concerns that share the same
/// internal-API-key trust boundary: fetching a remote app's self-declared capabilities from its own
/// PermissionsSourceUrl, and pushing this service's own audit-log entries to AuthService's central
/// log.
///
/// Failures are logged, not thrown — a transient AuthService (or remote-app) outage during a
/// registry edit shouldn't block the admin's edit here; POST /api/remote-apps/resync-permissions
/// exists as the manual recovery path once everything is back.
/// </summary>
public class AuthServiceClient(HttpClient httpClient, IOptions<AuthIntegrationOptions> options, ILogger<AuthServiceClient> logger)
{
    private readonly AuthIntegrationOptions _options = options.Value;

    private record UpsertCapabilityRequest(string Key, string DisplayName, int SortOrder = 100);
    private record UpsertFeatureRequest(string Key, string DisplayName, int SortOrder, IReadOnlyList<UpsertCapabilityRequest> Capabilities);
    private record DeactivateFeatureRequest(string Key);
    private record ResyncFeaturesRequest(IReadOnlyList<UpsertFeatureRequest> Features);
    private record RecordAuditLogRequest(string ServiceName, Guid? ActorUserId, string? ActorName, string Action, string? EntityType, string? EntityId, string? Details);

    public Task<bool> UpsertAsync(
        string featureKey, string displayName, int sortOrder,
        IReadOnlyList<(string Key, string DisplayName)> capabilities, CancellationToken ct = default) =>
        PostAsync(
            "internal/permission-features/upsert",
            new UpsertFeatureRequest(featureKey, displayName, sortOrder, ToCapabilityRequests(capabilities)),
            ct);

    public Task<bool> DeactivateAsync(string featureKey, CancellationToken ct = default) =>
        PostAsync("internal/permission-features/deactivate", new DeactivateFeatureRequest(featureKey), ct);

    public Task<bool> ResyncAsync(
        IReadOnlyList<(string Key, string DisplayName, int SortOrder, IReadOnlyList<(string Key, string DisplayName)> Capabilities)> features,
        CancellationToken ct = default) =>
        PostAsync(
            "internal/permission-features/resync",
            new ResyncFeaturesRequest(features
                .Select(f => new UpsertFeatureRequest(f.Key, f.DisplayName, f.SortOrder, ToCapabilityRequests(f.Capabilities)))
                .ToList()),
            ct);

    public Task<bool> PushAuditLogAsync(string action, string? entityType, string? entityId, string? details, Guid? actorUserId, string? actorName, CancellationToken ct = default) =>
        PostAsync(
            "internal/audit-logs",
            new RecordAuditLogRequest("ModuleRegistry", actorUserId, actorName, action, entityType, entityId, details),
            ct);

    private record RemoteCapabilitiesResponse(List<RemoteCapabilityEntry>? Capabilities);
    private record RemoteCapabilityEntry([property: JsonPropertyName("key")] string Key, [property: JsonPropertyName("displayName")] string DisplayName);

    /// <summary>
    /// GETs a remote app's own PermissionsSourceUrl, expecting `{ "capabilities": [{ "key",
    /// "displayName" }] }`. Returns null (never an empty list) on any failure so callers can tell
    /// "unreachable, keep the last-known set" apart from "reachable and genuinely declares zero
    /// capabilities".
    /// </summary>
    public async Task<IReadOnlyList<(string Key, string DisplayName)>?> FetchRemoteCapabilitiesAsync(string sourceUrl, CancellationToken ct = default)
    {
        try
        {
            using var response = await httpClient.GetAsync(sourceUrl, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Remote app permissions source {Url} returned {StatusCode}. Keeping last-known capability set.", sourceUrl, response.StatusCode);
                return null;
            }

            var body = await response.Content.ReadFromJsonAsync<RemoteCapabilitiesResponse>(cancellationToken: ct);
            if (body?.Capabilities is null)
            {
                logger.LogWarning("Remote app permissions source {Url} returned an unexpected shape. Keeping last-known capability set.", sourceUrl);
                return null;
            }

            return body.Capabilities.Select(c => (c.Key, c.DisplayName)).ToList();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to fetch remote app permissions from {Url}. Keeping last-known capability set.", sourceUrl);
            return null;
        }
    }

    private static IReadOnlyList<UpsertCapabilityRequest> ToCapabilityRequests(IReadOnlyList<(string Key, string DisplayName)> capabilities) =>
        capabilities.Select((c, i) => new UpsertCapabilityRequest(c.Key, c.DisplayName, i * 10)).ToList();

    private async Task<bool> PostAsync<TBody>(string path, TBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.BaseUrl))
        {
            logger.LogWarning("AuthService__BaseUrl is not configured — skipping call to {Path}.", path);
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
                    "AuthService rejected call to {Path}: {StatusCode}. Run resync-permissions once it's fixed.",
                    path, response.StatusCode);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to reach AuthService for call to {Path}. Run resync-permissions once it's reachable.", path);
            return false;
        }
    }
}
