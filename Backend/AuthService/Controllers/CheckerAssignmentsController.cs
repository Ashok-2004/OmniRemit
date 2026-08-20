using AuthService.Application.DTOs;
using AuthService.Application.Services;
using AuthService.Infrastructure.Security;
using AuthService.Infrastructure.Seed;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

/// <summary>
/// Admin-only: maps modules to their eligible checkers. This is the one central configuration surface
/// for the whole Maker-Checker system — "one Checker Assignment setup for the entire platform" per the
/// requirement. Manage requires its own, narrower capability than the Approvals feature's own
/// View/Approve, so an ordinary checker can see who else is assigned (View) without being able to
/// reassign checkers (Manage) themselves.
/// </summary>
[ApiController]
[Route("api/checker-assignments")]
[Authorize]
public class CheckerAssignmentsController(CheckerAssignmentAppService assignments) : ControllerBase
{
    private const string Feature = AuthDbSeeder.HostFeatureKeys.SystemCheckerAssignment;

    [HttpGet]
    [RequirePermission(Feature, "View")]
    public async Task<ActionResult<IReadOnlyList<CheckerAssignmentDto>>> List([FromQuery] string? module, CancellationToken ct)
        => Ok(await assignments.ListAsync(module, ct));

    [HttpPost]
    [RequirePermission(Feature, "Manage")]
    public async Task<ActionResult<CheckerAssignmentDto>> Upsert([FromBody] UpsertCheckerAssignmentRequest request, CancellationToken ct)
        => Ok(await assignments.UpsertAsync(request.Module, request.CheckerUserId, CurrentUserId(), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission(Feature, "Manage")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await assignments.DeleteAsync(id, CurrentUserId(), ct);
        return NoContent();
    }

    private Guid? CurrentUserId()
    {
        var sub = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
        return Guid.TryParse(sub, out var id) ? id : null;
    }
}
