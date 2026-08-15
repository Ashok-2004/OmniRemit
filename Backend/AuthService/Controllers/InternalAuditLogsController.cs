using AuthService.Application.DTOs;
using AuthService.Application.Services;
using AuthService.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

/// <summary>
/// Generic audit-log ingestion for every OTHER service (ModuleRegistry, EmployeeService, any future
/// remote's backend) — the same shared static API key as the permission-feature sync endpoints, not
/// end-user JWTs. AuthService writes its own User/Role audit entries in-process, see
/// UserAppService/RoleAppService; this is only for everyone else.
/// </summary>
[ApiController]
[Route("internal/audit-logs")]
[AllowAnonymous]
[TypeFilter(typeof(InternalApiKeyFilter))]
public class InternalAuditLogsController(AuditLogAppService auditLog) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Record([FromBody] RecordAuditLogRequest request, CancellationToken ct)
    {
        var sourceIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        await auditLog.WriteAsync(
            request.ServiceName, request.ActorUserId, request.ActorName, request.Action,
            request.EntityType, request.EntityId, request.Details, sourceIp, ct);
        return NoContent();
    }
}
