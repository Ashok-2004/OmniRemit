using System.Text.Json;
using System.Threading.Tasks;
using backend.Data;
using backend.Infrastructure.Security;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

/// <summary>
/// Where AuthService replays an approved Field Settings mutation — the other half of
/// AuthServiceClient.SubmitApprovalAsync's CallbackUrl. Guarded by the same shared X-Internal-Api-Key
/// trust boundary as every internal endpoint in the platform, mirroring AuthService's own
/// InternalAuditLogsController shape exactly.
/// </summary>
[ApiController]
[Route("internal/approvals")]
[AllowAnonymous]
[TypeFilter(typeof(InternalApiKeyFilter))]
public class InternalApprovalsController(FieldConfigService fieldConfigService) : ControllerBase
{
    [HttpPost("apply")]
    public async Task<IActionResult> Apply([FromBody] ApplyApprovedMutationRequest request)
    {
        if (request.Action != "Update" || !Enum.TryParse<ProfileType>(request.EntityId, ignoreCase: true, out var profileType))
        {
            return BadRequest(new { message = $"No replay handler for action '{request.Action}' / entity '{request.EntityId}'." });
        }

        var fields = JsonSerializer.Deserialize<List<FieldConfig>>(request.NewDataJson)!;
        await fieldConfigService.ReplaceAsync(profileType, fields, request.ActingUserId, request.ActingUserName, bypassApproval: true);

        return NoContent();
    }
}
