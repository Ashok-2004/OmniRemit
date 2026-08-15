using AuthService.Application.DTOs;
using AuthService.Application.Services;
using AuthService.Infrastructure.Security;
using AuthService.Infrastructure.Seed;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

[ApiController]
[Route("api/audit-logs")]
[Authorize]
public class AuditLogsController(AuditLogAppService auditLog) : ControllerBase
{
    private const string Feature = AuthDbSeeder.HostFeatureKeys.SystemAuditLogs;

    [HttpGet]
    [RequirePermission(Feature, "View")]
    public async Task<ActionResult<PagedResult<AuditLogDto>>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? service = null,
        [FromQuery] string? action = null,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        CancellationToken ct = default)
        => Ok(await auditLog.ListAsync(Math.Max(page, 1), Math.Clamp(pageSize, 1, 100), service, action, from, to, ct));
}
