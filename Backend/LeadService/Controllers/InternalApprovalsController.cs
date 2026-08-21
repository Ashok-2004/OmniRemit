using System.Text.Json;
using LeadManagement.Api.Infrastructure;
using LeadManagement.Api.Infrastructure.Security;
using LeadManagement.Api.Models.Dtos;
using LeadManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LeadManagement.Api.Controllers;

/// <summary>
/// Where AuthService replays an approved Lead mutation — the other half of
/// AuthServiceClient.SubmitApprovalAsync's CallbackUrl. Guarded by the same shared X-Internal-Api-Key
/// trust boundary as every internal endpoint in the platform, mirroring AuthService's own
/// InternalAuditLogsController shape exactly.
///
/// LeadsController pushes the central "lead.created"/"lead.updated"/"lead.deleted" audit entry itself
/// after a direct call succeeds — since a replay never goes through that controller, this endpoint
/// pushes the equivalent entry itself, attributed to the maker (request.ActingUserId/ActingUserName)
/// rather than whoever is signed in (there is no signed-in caller here — this is a service-to-service
/// call), matching AuthService's own "replayed audit row stays attributed to the maker" rule.
/// </summary>
[ApiController]
[Route("internal/approvals")]
[AllowAnonymous]
[TypeFilter(typeof(InternalApiKeyFilter))]
public class InternalApprovalsController(ILeadService leadService, AuthServiceClient authServiceClient) : ControllerBase
{
    [HttpPost("apply")]
    public async Task<IActionResult> Apply([FromBody] ApplyApprovedMutationRequest request)
    {
        switch (request.Action)
        {
            case "Create":
                var createDto = JsonSerializer.Deserialize<CreateLeadDto>(request.NewDataJson)!;
                var created = await leadService.CreateLeadAsync(createDto, request.ActingUserId, bypassApproval: true);
                await authServiceClient.PushAuditLogAsync(
                    "lead.created", "Lead", created.Applied!.Id, $"Created lead for '{created.Applied.Name}' ({created.Applied.Product})",
                    request.ActingUserId, request.ActingUserName, created.Applied.Name);
                break;

            case "Update":
                var updateDto = JsonSerializer.Deserialize<UpdateLeadDto>(request.NewDataJson)!;
                var updated = await leadService.UpdateLeadAsync(request.EntityId!, updateDto, request.ActingUserId, bypassApproval: true);
                await authServiceClient.PushAuditLogAsync(
                    "lead.updated", "Lead", request.EntityId, $"Updated lead '{updated.Applied!.Name}'",
                    request.ActingUserId, request.ActingUserName, updated.Applied.Name);
                break;

            case "Delete":
                var deleteDto = JsonSerializer.Deserialize<DeleteLeadDto>(request.NewDataJson)!;
                await leadService.DeleteLeadAsync(request.EntityId!, deleteDto, request.ActingUserId, bypassApproval: true);
                await authServiceClient.PushAuditLogAsync(
                    "lead.deleted", "Lead", request.EntityId, $"Deleted lead (Reason: {deleteDto.DeleteReason})",
                    request.ActingUserId, request.ActingUserName, null);
                break;

            default:
                return BadRequest(new { message = $"No replay handler for action '{request.Action}'." });
        }

        return NoContent();
    }
}
