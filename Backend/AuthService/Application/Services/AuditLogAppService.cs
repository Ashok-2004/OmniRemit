using AuthService.Application.DTOs;
using AuthService.Domain.Entities;
using AuthService.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Application.Services;

/// <summary>
/// The single sink every service's audit trail lands in. AuthService writes its own User/Role
/// mutations directly (in-process, see UserAppService/RoleAppService) — no HTTP round-trip needed
/// since it's the same process. Everyone else (ModuleRegistry, EmployeeService, any future remote's
/// backend) posts here via the internal API-key-protected endpoint. One table, one query, whether
/// the action happened in the host or a remote app.
/// </summary>
public class AuditLogAppService(AuthDbContext db)
{
    public async Task WriteAsync(
        string serviceName, Guid? actorUserId, string? actorName, string action,
        string? entityType, string? entityId, string? details, string? sourceIp = null, CancellationToken ct = default)
    {
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            OccurredAt = DateTimeOffset.UtcNow,
            ServiceName = serviceName,
            ActorUserId = actorUserId,
            ActorName = actorName,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Details = details,
            SourceIp = sourceIp,
        });
        await db.SaveChangesAsync(ct);
    }

    public async Task<PagedResult<AuditLogDto>> ListAsync(
        int page, int pageSize, string? service, string? action, DateTimeOffset? from, DateTimeOffset? to, CancellationToken ct = default)
    {
        var query = db.AuditLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(service))
        {
            query = query.Where(a => a.ServiceName == service);
        }

        if (!string.IsNullOrWhiteSpace(action))
        {
            query = query.Where(a => a.Action.Contains(action));
        }

        if (from is not null)
        {
            query = query.Where(a => a.OccurredAt >= from);
        }

        if (to is not null)
        {
            query = query.Where(a => a.OccurredAt <= to);
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(a => a.OccurredAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AuditLogDto(a.Id, a.OccurredAt, a.ServiceName, a.ActorUserId, a.ActorName, a.Action, a.EntityType, a.EntityId, a.Details))
            .ToListAsync(ct);

        return new PagedResult<AuditLogDto>(items, total, page, pageSize);
    }
}
