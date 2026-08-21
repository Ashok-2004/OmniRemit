using System.Net.Http.Json;
using AuthService.Application.DTOs;
using AuthService.Options;
using Microsoft.Extensions.Options;

namespace AuthService.Infrastructure;

/// <summary>
/// The other half of InternalApprovalsController: where a remote-owned ApprovalRequest gets replayed.
/// ApprovalAppService.ReplayAsync's default case (every module AuthService doesn't own in-process) POSTs
/// here — to the ORIGIN service's own CallbackUrl, not a fixed address, since each remote exposes its own
/// internal/approvals/apply endpoint. Reuses the same shared Internal:ApiKey trust boundary as every other
/// internal call in the platform.
///
/// Deliberately NOT best-effort like AuthServiceClient.PushAuditLogAsync elsewhere in this codebase — a
/// failed audit-log push only loses a log line, but a failed replay must leave the ApprovalRequest Pending
/// rather than silently mark it Approved with nothing actually applied. Callers must let exceptions
/// propagate.
/// </summary>
public class RemoteApprovalCallbackClient(HttpClient httpClient, IOptions<InternalApiOptions> options)
{
    public async Task ApplyAsync(string callbackUrl, ApplyApprovedMutationRequest payload, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, callbackUrl)
        {
            Content = JsonContent.Create(payload),
        };
        request.Headers.Add("X-Internal-Api-Key", options.Value.ApiKey);

        var response = await httpClient.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException(
                $"Replaying the approved mutation against '{callbackUrl}' failed with {(int)response.StatusCode}: {body}");
        }
    }
}
