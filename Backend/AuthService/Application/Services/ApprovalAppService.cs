using System.Text.Json;
using AuthService.Application.DTOs;
using AuthService.Application.Exceptions;
using AuthService.Domain.Entities;
using AuthService.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Application.Services;

/// <summary>
/// The checker-side half of the approval engine — listing/reading requests, and deciding them.
///
/// Depends on UserAppService/RoleAppService (to replay an approved mutation through the exact same
/// validated method a direct call would have used), which is why this is a separate service from
/// ApprovalGatingService: those two app services depend on the gating service, not on this one, so
/// there is no dependency cycle.
/// </summary>
public class ApprovalAppService(
    AuthDbContext db, AuditLogAppService auditLog, UserAppService userAppService, RoleAppService roleAppService)
{
    private const string ServiceName = "AuthService";

    public async Task<PagedResult<ApprovalRequestListItemDto>> ListAsync(
        int page, int pageSize, string? module, string? status, Guid? makerId, Guid? checkerId,
        DateTimeOffset? from, DateTimeOffset? to, CancellationToken ct = default)
    {
        var query = BuildFilteredQuery(module, status, makerId, checkerId, from, to);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(r => r.RequestedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => ToListItemDto(r))
            .ToListAsync(ct);

        return new PagedResult<ApprovalRequestListItemDto>(items, total, page, pageSize);
    }

    public async Task<ApprovalRequestDetailDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var request = await db.ApprovalRequests.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw NotFound(id);
        return ToDetailDto(request);
    }

    /// <summary>Real DB aggregates — never client-derived from a partial page of rows.</summary>
    public async Task<ApprovalSummaryDto> SummaryAsync(Guid currentUserId, CancellationToken ct = default)
    {
        // DateTimeOffset.UtcNow.Date returns a plain DateTime (Kind=Unspecified) — assigning that
        // straight to a DateTimeOffset silently reinterprets it in the server process's LOCAL offset
        // (e.g. +05:30), not UTC. Npgsql then rejects it outright: "timestamp with time zone" only
        // accepts offset 0. Constructing explicitly with TimeSpan.Zero is what actually stays UTC.
        var todayStart = new DateTimeOffset(DateTimeOffset.UtcNow.Date, TimeSpan.Zero);

        var pendingTotal = await db.ApprovalRequests.CountAsync(r => r.Status == ApprovalStatus.Pending, ct);
        var approvedToday = await db.ApprovalRequests.CountAsync(
            r => r.Status == ApprovalStatus.Approved && r.DecidedAt >= todayStart, ct);
        var rejectedToday = await db.ApprovalRequests.CountAsync(
            r => r.Status == ApprovalStatus.Rejected && r.DecidedAt >= todayStart, ct);
        var assignedToMePending = await db.ApprovalRequests.CountAsync(
            r => r.Status == ApprovalStatus.Pending && r.CheckerId == currentUserId, ct);

        return new ApprovalSummaryDto(pendingTotal, approvedToday, rejectedToday, assignedToMePending);
    }

    public async Task<ApprovalRequestDetailDto> ApproveAsync(Guid id, Guid checkerUserId, CancellationToken ct = default)
    {
        var request = await db.ApprovalRequests.FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw NotFound(id);
        EnsureDecidable(request, checkerUserId);

        // Replay the original mutation through the SAME validated method a direct call would have
        // used — re-running its own conflict/existence checks for free, so "the email was taken by
        // someone else while this was pending" surfaces as a real error to the checker instead of
        // silently corrupting data. actingUserId is the MAKER (not the checker), so the resulting
        // "user.created"/"role.updated" audit row is attributed exactly as an ungated mutation would
        // be — it still means "this reflects this person's account/role", not "who clicked approve".
        //
        // If replay throws (e.g. NotFoundAppException because the target was deleted while this sat
        // pending), that exception is left to propagate: the request stays Pending, nothing here marks
        // it decided, and the error surfaces to the checker's click.
        await ReplayAsync(request, ct);

        request.Status = ApprovalStatus.Approved;
        request.DecidedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var checkerName = await db.Users.AsNoTracking().Where(u => u.Id == checkerUserId).Select(u => u.Name).FirstOrDefaultAsync(ct);
        await auditLog.WriteAsync(
            ServiceName, checkerUserId, checkerName, "approval.approved", "ApprovalRequest", request.Id.ToString(),
            $"Approved {request.Action} on {request.Module}" + (request.EntityLabel is not null ? $" ({request.EntityLabel})" : "") + $" — requested by {request.MakerName}.",
            entityLabel: request.EntityLabel, ct: ct);

        return ToDetailDto(request);
    }

    public async Task<ApprovalRequestDetailDto> RejectAsync(Guid id, Guid checkerUserId, string reason, CancellationToken ct = default)
    {
        var request = await db.ApprovalRequests.FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw NotFound(id);
        EnsureDecidable(request, checkerUserId);

        request.Status = ApprovalStatus.Rejected;
        request.DecidedAt = DateTimeOffset.UtcNow;
        request.RejectionReason = reason;
        await db.SaveChangesAsync(ct);

        var checkerName = await db.Users.AsNoTracking().Where(u => u.Id == checkerUserId).Select(u => u.Name).FirstOrDefaultAsync(ct);
        await auditLog.WriteAsync(
            ServiceName, checkerUserId, checkerName, "approval.rejected", "ApprovalRequest", request.Id.ToString(),
            $"Rejected {request.Action} on {request.Module}" + (request.EntityLabel is not null ? $" ({request.EntityLabel})" : "") + $" — requested by {request.MakerName}. Reason: {reason}",
            entityLabel: request.EntityLabel, ct: ct);

        return ToDetailDto(request);
    }

    /// <summary>Server-side enforcement of both confirmed rules, defense in depth even though the maker
    /// is already excluded from checker auto-selection: the request must still be Pending, and the
    /// caller must be THIS request's specific assigned checker — not just any checker of the module,
    /// and never the maker.</summary>
    private static void EnsureDecidable(ApprovalRequest request, Guid checkerUserId)
    {
        if (request.Status != ApprovalStatus.Pending)
        {
            throw new ConflictAppException($"This request has already been {request.Status.ToLowerInvariant()}.");
        }

        if (request.MakerId == checkerUserId)
        {
            throw new ForbiddenAppException("You cannot approve or reject your own request.");
        }

        if (request.CheckerId != checkerUserId)
        {
            throw new ForbiddenAppException("Only the assigned checker can act on this request.");
        }
    }

    private async Task ReplayAsync(ApprovalRequest request, CancellationToken ct)
    {
        switch (request.Module, request.Action)
        {
            case (ApprovalModuleKeys.Users, ApprovalActionKeys.Create):
                var createUser = JsonSerializer.Deserialize<CreateUserRequest>(request.NewDataJson)!;
                await userAppService.CreateAsync(createUser, request.MakerId, ct, bypassApproval: true);
                break;

            case (ApprovalModuleKeys.Users, ApprovalActionKeys.Update):
                var updateUser = JsonSerializer.Deserialize<UpdateUserRequest>(request.NewDataJson)!;
                await userAppService.UpdateAsync(Guid.Parse(request.EntityId!), updateUser, request.MakerId, ct, bypassApproval: true);
                break;

            case (ApprovalModuleKeys.Users, ApprovalActionKeys.Enable):
                await userAppService.UpdateStatusAsync(Guid.Parse(request.EntityId!), true, request.MakerId, ct, bypassApproval: true);
                break;

            case (ApprovalModuleKeys.Users, ApprovalActionKeys.Disable):
                await userAppService.UpdateStatusAsync(Guid.Parse(request.EntityId!), false, request.MakerId, ct, bypassApproval: true);
                break;

            case (ApprovalModuleKeys.Users, ApprovalActionKeys.Delete):
                await userAppService.DeleteAsync(Guid.Parse(request.EntityId!), request.MakerId, ct, bypassApproval: true);
                break;

            case (ApprovalModuleKeys.Roles, ApprovalActionKeys.Create):
                var createRole = JsonSerializer.Deserialize<UpsertRoleRequest>(request.NewDataJson)!;
                await roleAppService.CreateAsync(createRole, request.MakerId, ct, bypassApproval: true);
                break;

            case (ApprovalModuleKeys.Roles, ApprovalActionKeys.Update):
                var updateRole = JsonSerializer.Deserialize<UpsertRoleRequest>(request.NewDataJson)!;
                await roleAppService.UpdateAsync(Guid.Parse(request.EntityId!), updateRole, request.MakerId, ct, bypassApproval: true);
                break;

            case (ApprovalModuleKeys.Roles, ApprovalActionKeys.Delete):
                await roleAppService.DeleteAsync(Guid.Parse(request.EntityId!), request.MakerId, ct, bypassApproval: true);
                break;

            // Phase 2: requests from a remote service (request.SourceService != "AuthService") get
            // replayed by POSTing to request.CallbackUrl (X-Internal-Api-Key protected, mirroring
            // InternalAuditLogsController's pattern) instead of a case here — this switch only ever
            // needs to grow for modules AuthService itself owns.
            default:
                throw new InvalidOperationException($"No replay handler for {request.Module}/{request.Action}.");
        }
    }

    private IQueryable<ApprovalRequest> BuildFilteredQuery(
        string? module, string? status, Guid? makerId, Guid? checkerId, DateTimeOffset? from, DateTimeOffset? to)
    {
        var query = db.ApprovalRequests.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(module)) query = query.Where(r => r.Module == module);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(r => r.Status == status);
        if (makerId is not null) query = query.Where(r => r.MakerId == makerId);
        if (checkerId is not null) query = query.Where(r => r.CheckerId == checkerId);
        if (from is not null) query = query.Where(r => r.RequestedAt >= from);
        if (to is not null) query = query.Where(r => r.RequestedAt <= to);

        return query;
    }

    private static ApprovalRequestListItemDto ToListItemDto(ApprovalRequest r) => new(
        r.Id, r.Module, r.Action, r.EntityType, r.EntityLabel, r.Status,
        r.MakerId, r.MakerName, r.CheckerId, r.CheckerName, r.RequestedAt, r.DecidedAt, r.RejectionReason);

    private static ApprovalRequestDetailDto ToDetailDto(ApprovalRequest r) => new(
        r.Id, r.Module, r.Action, r.EntityType, r.EntityId, r.EntityLabel, r.OldDataJson, r.NewDataJson,
        r.Status, r.MakerId, r.MakerName, r.CheckerId, r.CheckerName, r.RequestedAt, r.DecidedAt, r.RejectionReason);

    private static NotFoundAppException NotFound(Guid id) => new($"Approval request '{id}' was not found.");
}
