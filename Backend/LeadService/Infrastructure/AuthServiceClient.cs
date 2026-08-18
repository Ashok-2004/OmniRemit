using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using LeadManagement.Api.Options;

namespace LeadManagement.Api.Infrastructure;

/// <summary>
/// Pushes LeadService mutation audit-log entries to AuthService's central AuditLogs table
/// using the shared X-Internal-Api-Key trust boundary. Failures are logged, not thrown.
/// </summary>
public class AuthServiceClient(HttpClient httpClient, IOptions<AuthIntegrationOptions> options, ILogger<AuthServiceClient> logger)
{
    private readonly AuthIntegrationOptions _options = options.Value;

    private record RecordAuditLogRequest(string ServiceName, Guid? ActorUserId, string? ActorName, string Action, string? EntityType, string? EntityId, string? Details);

    public Task<bool> PushAuditLogAsync(string action, string? entityType, string? entityId, string? details, Guid? actorUserId, string? actorName, CancellationToken ct = default) =>
        PostAsync("internal/audit-logs", new RecordAuditLogRequest("LeadService", actorUserId, actorName, action, entityType, entityId, details), ct);

    private async Task<bool> PostAsync<TBody>(string path, TBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.BaseUrl))
        {
            logger.LogDebug("AuthService__BaseUrl is not configured — skipping call to {Path}.", path);
            return false;
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{_options.BaseUrl.TrimEnd('/')}/{path}")
            {
                Content = JsonContent.Create(body),
            };
            if (!string.IsNullOrWhiteSpace(_options.InternalApiKey))
            {
                request.Headers.Add("X-Internal-Api-Key", _options.InternalApiKey);
            }

            var response = await httpClient.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("AuthService rejected call to {Path}: {StatusCode}.", path, response.StatusCode);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to reach AuthService for call to {Path}.", path);
            return false;
        }
    }
}
