using AuthService.Application.DTOs;
using AuthService.Application.Services;
using AuthService.Infrastructure.Security;
using AuthService.Infrastructure.Seed;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

/// <summary>
/// The centralized Approval Center — one source of truth across the whole platform. There is
/// deliberately no POST here to create a request: the only path to a new ApprovalRequest row is a
/// gated mutation elsewhere in the API (see ApprovalGatingService.SubmitAsync), so a client can never
/// fabricate an approval request unconnected to a real gated attempt.
/// </summary>
[ApiController]
[Route("api/approvals")]
[Authorize]
public class ApprovalsController(ApprovalAppService approvals) : ControllerBase
{
    private const string Feature = AuthDbSeeder.HostFeatureKeys.SystemApprovals;

    [HttpGet]
    [RequirePermission(Feature, "View")]
    public async Task<ActionResult<PagedResult<ApprovalRequestListItemDto>>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? module = null,
        [FromQuery] string? status = null,
        [FromQuery] Guid? makerId = null,
        [FromQuery] bool assignedToMe = false,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        CancellationToken ct = default)
    {
        var checkerId = assignedToMe ? CurrentUserId() : null;
        return Ok(await approvals.ListAsync(Math.Max(page, 1), Math.Clamp(pageSize, 1, 100), module, status, makerId, checkerId, from, to, ct));
    }

    /// <summary>
    /// "My Requests" — the maker dashboard. Deliberately NOT gated by the Approvals "View" capability:
    /// every authenticated user must be able to track their own submissions regardless of whether they
    /// hold Approval Center access, and this can never leak anyone else's requests since makerId is
    /// always the caller's own id, never client-supplied.
    /// </summary>
    [HttpGet("mine")]
    public async Task<ActionResult<PagedResult<ApprovalRequestListItemDto>>> ListMine(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25, [FromQuery] string? status = null, CancellationToken ct = default)
    {
        var currentUserId = CurrentUserId();
        if (currentUserId is null) return Unauthorized();
        return Ok(await approvals.ListAsync(Math.Max(page, 1), Math.Clamp(pageSize, 1, 100), module: null, status, makerId: currentUserId, checkerId: null, from: null, to: null, ct));
    }

    [HttpGet("{id:guid}")]
    [RequirePermission(Feature, "View")]
    public async Task<ActionResult<ApprovalRequestDetailDto>> Get(Guid id, CancellationToken ct)
        => Ok(await approvals.GetAsync(id, ct));

    [HttpGet("summary")]
    [RequirePermission(Feature, "View")]
    public async Task<ActionResult<ApprovalSummaryDto>> Summary(CancellationToken ct)
    {
        var currentUserId = CurrentUserId();
        if (currentUserId is null) return Unauthorized();
        return Ok(await approvals.SummaryAsync(currentUserId.Value, ct));
    }

    [HttpPost("{id:guid}/approve")]
    [RequirePermission(Feature, "Approve")]
    public async Task<ActionResult<ApprovalRequestDetailDto>> Approve(Guid id, CancellationToken ct)
    {
        var currentUserId = CurrentUserId();
        if (currentUserId is null) return Unauthorized();
        return Ok(await approvals.ApproveAsync(id, currentUserId.Value, ct));
    }

    [HttpPost("{id:guid}/reject")]
    [RequirePermission(Feature, "Approve")]
    public async Task<ActionResult<ApprovalRequestDetailDto>> Reject(Guid id, [FromBody] RejectApprovalRequest request, CancellationToken ct)
    {
        var currentUserId = CurrentUserId();
        if (currentUserId is null) return Unauthorized();
        return Ok(await approvals.RejectAsync(id, currentUserId.Value, request.Reason, ct));
    }

    private Guid? CurrentUserId()
    {
        var sub = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
        return Guid.TryParse(sub, out var id) ? id : null;
    }
}
