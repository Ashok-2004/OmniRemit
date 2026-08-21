using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ModuleRegistry.Application.DTOs;
using ModuleRegistry.Application.Services;
using ModuleRegistry.Infrastructure.Security;

namespace ModuleRegistry.Controllers;

/// <summary>
/// Where AuthService replays an approved mutation that originated here — the other half of
/// AuthServiceClient.SubmitApprovalAsync's CallbackUrl. Guarded by the same shared X-Internal-Api-Key
/// trust boundary as every internal endpoint in the platform, mirroring AuthService's own
/// InternalAuditLogsController shape exactly.
/// </summary>
[ApiController]
[Route("internal/approvals")]
[AllowAnonymous]
[TypeFilter(typeof(InternalApiKeyFilter))]
public class InternalApprovalsController(RemoteAppAppService remoteApps) : ControllerBase
{
    [HttpPost("apply")]
    public async Task<IActionResult> Apply([FromBody] ApplyApprovedMutationRequest request, CancellationToken ct)
    {
        switch (request.Action)
        {
            case "Create":
                var createRequest = JsonSerializer.Deserialize<CreateRemoteAppRequest>(request.NewDataJson)!;
                await remoteApps.CreateAsync(createRequest, request.ActingUserId, request.ActingUserName, ct, bypassApproval: true);
                break;

            case "Update":
                var updateRequest = JsonSerializer.Deserialize<UpdateRemoteAppRequest>(request.NewDataJson)!;
                await remoteApps.UpdateAsync(Guid.Parse(request.EntityId!), updateRequest, request.ActingUserId, request.ActingUserName, ct, bypassApproval: true);
                break;

            case "Enable":
            case "Disable":
                var statusRequest = JsonSerializer.Deserialize<UpdateRemoteAppStatusRequest>(request.NewDataJson)!;
                await remoteApps.UpdateStatusAsync(Guid.Parse(request.EntityId!), statusRequest.Status, statusRequest.MaintenanceMessage, request.ActingUserId, request.ActingUserName, ct, bypassApproval: true);
                break;

            case "Delete":
                await remoteApps.DeleteAsync(Guid.Parse(request.EntityId!), request.ActingUserId, request.ActingUserName, ct, bypassApproval: true);
                break;

            default:
                return BadRequest(new { message = $"No replay handler for action '{request.Action}'." });
        }

        return NoContent();
    }
}
