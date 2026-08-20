using AuthService.Application.DTOs;
using AuthService.Application.Exceptions;
using AuthService.Domain.Entities;
using AuthService.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Application.Services;

/// <summary>
/// Admin-facing CRUD over which users are eligible checkers for which module. A module is gated
/// (Maker-Checker required) if and only if it has at least one row here — see
/// ApprovalGatingService.IsGatedAsync.
/// </summary>
public class CheckerAssignmentAppService(AuthDbContext db, AuditLogAppService auditLog)
{
    private const string ServiceName = "AuthService";

    public async Task<IReadOnlyList<CheckerAssignmentDto>> ListAsync(string? module, CancellationToken ct = default)
    {
        var query = db.CheckerAssignments.AsNoTracking().Include(c => c.CheckerUser).AsQueryable();
        if (!string.IsNullOrWhiteSpace(module))
        {
            query = query.Where(c => c.Module == module);
        }

        return await query
            .OrderBy(c => c.Module).ThenBy(c => c.CheckerUser!.Name)
            .Select(c => new CheckerAssignmentDto(c.Id, c.Module, c.CheckerUserId, c.CheckerUser!.Name, c.CreatedAt))
            .ToListAsync(ct);
    }

    public async Task<CheckerAssignmentDto> UpsertAsync(string module, Guid checkerUserId, Guid? actingUserId, CancellationToken ct = default)
    {
        var checkerUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == checkerUserId, ct)
            ?? throw new NotFoundAppException($"User '{checkerUserId}' was not found.");

        var existing = await db.CheckerAssignments.FirstOrDefaultAsync(c => c.Module == module && c.CheckerUserId == checkerUserId, ct);
        if (existing is not null)
        {
            // Already assigned — treat as a no-op success rather than a conflict, so the UI doesn't
            // need to pre-check before offering "Add Checker".
            return new CheckerAssignmentDto(existing.Id, existing.Module, existing.CheckerUserId, checkerUser.Name, existing.CreatedAt);
        }

        var assignment = new CheckerAssignment
        {
            Id = Guid.NewGuid(),
            Module = module,
            CheckerUserId = checkerUserId,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = actingUserId,
        };
        db.CheckerAssignments.Add(assignment);
        await db.SaveChangesAsync(ct);

        var actorName = actingUserId is null ? null : await db.Users.AsNoTracking().Where(u => u.Id == actingUserId).Select(u => u.Name).FirstOrDefaultAsync(ct);
        await auditLog.WriteAsync(
            ServiceName, actingUserId, actorName, "checker_assignment.created", "CheckerAssignment", assignment.Id.ToString(),
            $"Assigned {checkerUser.Name} as a checker for '{module}'.", entityLabel: module, ct: ct);

        return new CheckerAssignmentDto(assignment.Id, module, checkerUserId, checkerUser.Name, assignment.CreatedAt);
    }

    public async Task DeleteAsync(Guid id, Guid? actingUserId, CancellationToken ct = default)
    {
        var assignment = await db.CheckerAssignments.Include(c => c.CheckerUser).FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new NotFoundAppException($"Checker assignment '{id}' was not found.");

        var module = assignment.Module;
        var checkerName = assignment.CheckerUser?.Name ?? "Unknown";

        db.CheckerAssignments.Remove(assignment);
        await db.SaveChangesAsync(ct);

        var actorName = actingUserId is null ? null : await db.Users.AsNoTracking().Where(u => u.Id == actingUserId).Select(u => u.Name).FirstOrDefaultAsync(ct);
        await auditLog.WriteAsync(
            ServiceName, actingUserId, actorName, "checker_assignment.deleted", "CheckerAssignment", id.ToString(),
            $"Removed {checkerName} as a checker for '{module}'.", entityLabel: module, ct: ct);
    }
}
