using AuthService.Application.DTOs;
using AuthService.Application.Exceptions;
using AuthService.Domain.Entities;
using AuthService.Domain.Enums;
using AuthService.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Application.Services;

/// <summary>
/// The maker-side half of the approval engine — deciding whether a module is gated, and if so, writing
/// the ApprovalRequest instead of letting the caller mutate directly.
///
/// Deliberately separate from ApprovalAppService (which handles the checker-side List/Get/Approve/
/// Reject) to avoid a DI cycle: ApprovalAppService.ApproveAsync calls back into UserAppService/
/// RoleAppService to replay an approved mutation, so those two services must depend only on this one,
/// never on ApprovalAppService itself.
///
/// There is deliberately no public HTTP-reachable "create a request" endpoint anywhere in the API —
/// the only path to a new ApprovalRequest row is SubmitAsync, called from inside a gated mutation
/// method after that method's own validation has already run. A client can never fabricate an approval
/// request unconnected to a real gated attempt.
/// </summary>
public class ApprovalGatingService(AuthDbContext db, AuditLogAppService auditLog)
{
    private const string ServiceName = "AuthService";

    public Task<bool> IsGatedAsync(string module, CancellationToken ct = default) =>
        db.CheckerAssignments.AnyAsync(c => c.Module == module, ct);

    /// <summary>
    /// <paramref name="sourceService"/>/<paramref name="callbackUrl"/>/<paramref name="correlationId"/>
    /// default to AuthService's own in-process values — UserAppService/RoleAppService's call sites are
    /// unaffected. A remote service submitting through InternalApprovalsController passes its own name,
    /// a callback URL to its own internal/approvals/apply endpoint, and a correlation id; ApprovalAppService.
    /// ReplayAsync's default case uses exactly these three fields to replay the mutation over HTTP instead
    /// of an in-process switch case.
    /// </summary>
    public async Task<ApprovalPendingDto> SubmitAsync(
        string module, string action, string? entityType, string? entityId, string? entityLabel,
        string? oldDataJson, string newDataJson, Guid makerId, CancellationToken ct = default,
        string sourceService = ServiceName, string? callbackUrl = null, string? correlationId = null)
    {
        var makerName = await db.Users.AsNoTracking().Where(u => u.Id == makerId).Select(u => u.Name).FirstOrDefaultAsync(ct);
        var (checkerId, checkerName) = await SelectCheckerAsync(module, makerId, ct);

        var request = new ApprovalRequest
        {
            Id = Guid.NewGuid(),
            Module = module,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            EntityLabel = entityLabel,
            OldDataJson = oldDataJson,
            NewDataJson = newDataJson,
            Status = ApprovalStatus.Pending,
            MakerId = makerId,
            MakerName = makerName,
            CheckerId = checkerId,
            CheckerName = checkerName,
            RequestedAt = DateTimeOffset.UtcNow,
            SourceService = sourceService,
            CallbackUrl = callbackUrl,
            CorrelationId = correlationId,
        };
        db.ApprovalRequests.Add(request);
        await db.SaveChangesAsync(ct);

        await auditLog.WriteAsync(
            ServiceName, makerId, makerName, "approval.requested", "ApprovalRequest", request.Id.ToString(),
            $"Requested {action} on {module}" + (entityLabel is not null ? $" ({entityLabel})" : "") + $" — assigned to {checkerName ?? "an eligible checker"}.",
            entityLabel: entityLabel, ct: ct);

        return new ApprovalPendingDto(request.Id, module, action, checkerName ?? "Unassigned");
    }

    /// <summary>
    /// Least-current-Pending-workload selection among a module's assigned checkers: picks whichever
    /// eligible checker currently has the fewest Pending requests assigned to them. Deterministic
    /// (ties broken by Id), needs no extra state (computed live from existing ApprovalRequest rows),
    /// and load-balances for free.
    ///
    /// Excludes the maker themselves — a module whose only eligible checker is also its maker must
    /// never silently self-approve; instead the mutation is rejected outright, per the confirmed rule
    /// that a maker can never approve their own request.
    /// </summary>
    private async Task<(Guid CheckerId, string? CheckerName)> SelectCheckerAsync(string module, Guid makerId, CancellationToken ct)
    {
        var eligible = await db.CheckerAssignments.AsNoTracking()
            .Where(c => c.Module == module && c.CheckerUserId != makerId)
            .Select(c => c.CheckerUserId)
            .Distinct()
            .ToListAsync(ct);

        if (eligible.Count == 0)
        {
            throw new ConflictAppException(
                $"No eligible checker is assigned to '{module}' other than yourself. Ask an administrator to assign another checker.");
        }

        var result = await TrySelectCheckerAsync(module, eligible, ct);
        return result ?? throw new ConflictAppException($"All checkers assigned to '{module}' are currently inactive.");
    }

    /// <summary>
    /// The non-throwing core of the least-workload algorithm, reused by
    /// CheckerAssignmentAppService.DeleteAsync to find a replacement for requests orphaned by a checker
    /// removal — same "fewest current Pending requests, ties by Id" selection, just over a
    /// caller-supplied eligible set (already maker-excluded) instead of always deriving it from
    /// CheckerAssignments directly. Returns null when nobody in <paramref name="eligibleCheckerIds"/> is
    /// currently Active; the caller decides what that means for them (SelectCheckerAsync throws,
    /// CheckerAssignmentAppService.DeleteAsync blocks the removal).
    /// </summary>
    internal async Task<(Guid CheckerId, string? CheckerName)?> TrySelectCheckerAsync(
        string module, IReadOnlyList<Guid> eligibleCheckerIds, CancellationToken ct)
    {
        if (eligibleCheckerIds.Count == 0)
        {
            return null;
        }

        var active = await db.Users.AsNoTracking()
            .Where(u => eligibleCheckerIds.Contains(u.Id) && u.Status == UserStatus.Active)
            .Select(u => new { u.Id, u.Name })
            .ToListAsync(ct);

        if (active.Count == 0)
        {
            return null;
        }

        var activeIds = active.Select(a => a.Id).ToList();
        var pendingCounts = await db.ApprovalRequests.AsNoTracking()
            .Where(r => r.Status == ApprovalStatus.Pending && activeIds.Contains(r.CheckerId))
            .GroupBy(r => r.CheckerId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        var chosen = active
            .OrderBy(a => pendingCounts.GetValueOrDefault(a.Id, 0))
            .ThenBy(a => a.Id)
            .First();

        return (chosen.Id, chosen.Name);
    }
}
