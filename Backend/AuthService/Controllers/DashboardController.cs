using System.Text.Json;
using AuthService.Application.DTOs;
using AuthService.Application.Services;
using AuthService.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController(DashboardAppService dashboard) : ControllerBase
{
    /// <summary>
    /// Real aggregate counts for the host dashboard in one round trip.
    /// <para>
    /// Deliberately NOT decorated with [RequirePermission]: the response is filtered per-capability
    /// inside the service so a caller sees exactly the counts they are entitled to. A blanket
    /// attribute would 403 the whole endpoint for a user who legitimately can see some of it.
    /// </para>
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult<DashboardStatsDto>> Stats(CancellationToken ct)
    {
        var isAdministrator = User.FindFirst(JwtTokenService.AdministratorClaimType)?.Value == "true";
        var permsClaim = User.FindFirst(JwtTokenService.PermissionsClaimType)?.Value;
        var permissions = string.IsNullOrEmpty(permsClaim)
            ? new HashSet<string>()
            : (JsonSerializer.Deserialize<string[]>(permsClaim) ?? []).ToHashSet();

        return Ok(await dashboard.GetStatsAsync(isAdministrator, permissions, ct));
    }
}
