using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ModuleRegistry.Application.DTOs;
using ModuleRegistry.Application.Services;
using ModuleRegistry.Infrastructure.Security;

namespace ModuleRegistry.Controllers;

[ApiController]
[Route("api/remote-apps")]
[Authorize]
public class RemoteAppsController(RemoteAppAppService remoteApps) : ControllerBase
{
    // Must match AuthService.Infrastructure.Seed.AuthDbSeeder.HostFeatureKeys.SettingsApplications —
    // the two services don't share a code package, so this string is kept in sync by hand.
    private const string Feature = "host.settings.applications";

    [HttpGet]
    [RequirePermission(Feature, "View")]
    public async Task<ActionResult<PagedResult<RemoteAppDto>>> List(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25, [FromQuery] string? search = null, CancellationToken ct = default)
        => Ok(await remoteApps.ListAsync(Math.Max(page, 1), Math.Clamp(pageSize, 1, 100), search, ct));

    [HttpGet("{id:guid}")]
    [RequirePermission(Feature, "View")]
    public async Task<ActionResult<RemoteAppDto>> Get(Guid id, CancellationToken ct)
        => Ok(await remoteApps.GetAsync(id, ct));

    [HttpPost]
    [RequirePermission(Feature, "Register")]
    public async Task<ActionResult<RemoteAppDto>> Create([FromBody] CreateRemoteAppRequest request, CancellationToken ct)
    {
        var result = await remoteApps.CreateAsync(request, CurrentUserId(), CurrentUserName(), ct);
        return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission(Feature, "Edit")]
    public async Task<ActionResult<RemoteAppDto>> Update(Guid id, [FromBody] UpdateRemoteAppRequest request, CancellationToken ct)
        => Ok(await remoteApps.UpdateAsync(id, request, CurrentUserId(), CurrentUserName(), ct));

    [HttpPatch("{id:guid}/status")]
    [RequirePermission(Feature, "Disable")]
    public async Task<ActionResult<RemoteAppDto>> UpdateStatus(Guid id, [FromBody] UpdateRemoteAppStatusRequest request, CancellationToken ct)
        => Ok(await remoteApps.UpdateStatusAsync(id, request.Status, request.MaintenanceMessage, CurrentUserId(), CurrentUserName(), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission(Feature, "Delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await remoteApps.DeleteAsync(id, CurrentUserId(), CurrentUserName(), ct);
        return NoContent();
    }

    [HttpPost("resync-permissions")]
    [RequirePermission(Feature, "Edit")]
    public async Task<IActionResult> ResyncPermissions(CancellationToken ct)
    {
        var count = await remoteApps.ResyncPermissionsAsync(ct);
        return Ok(new { resyncedCount = count });
    }

    /// <summary>What the host's sidebar actually calls — any authenticated user, filtered server-side to what their token grants.</summary>
    [HttpGet("for-sidebar")]
    public async Task<ActionResult<IReadOnlyList<SidebarAppDto>>> ForSidebar(CancellationToken ct)
    {
        var isAdministrator = User.FindFirst(JwtClaimTypes.Administrator)?.Value == "true";
        var permsClaim = User.FindFirst(JwtClaimTypes.Permissions)?.Value;
        var permissions = string.IsNullOrEmpty(permsClaim)
            ? new HashSet<string>()
            : (JsonSerializer.Deserialize<string[]>(permsClaim) ?? []).ToHashSet();

        return Ok(await remoteApps.GetForSidebarAsync(isAdministrator, permissions, ct));
    }

    /// <summary>
    /// Real reachability of each registered app, for the host dashboard's system-health panel. Same
    /// visibility rule as the sidebar (any authenticated user, filtered to what their token grants),
    /// so this cannot be used to enumerate apps the caller has no access to.
    /// </summary>
    [HttpGet("health")]
    public async Task<ActionResult<IReadOnlyList<HealthEntryDto>>> Health(CancellationToken ct)
    {
        var (isAdministrator, permissions) = CallerAccess();
        return Ok(await remoteApps.GetHealthAsync(isAdministrator, permissions, ct));
    }

    private (bool IsAdministrator, IReadOnlySet<string> Permissions) CallerAccess()
    {
        var isAdministrator = User.FindFirst(JwtClaimTypes.Administrator)?.Value == "true";
        var permsClaim = User.FindFirst(JwtClaimTypes.Permissions)?.Value;
        var permissions = string.IsNullOrEmpty(permsClaim)
            ? new HashSet<string>()
            : (JsonSerializer.Deserialize<string[]>(permsClaim) ?? []).ToHashSet();

        return (isAdministrator, permissions);
    }

    private Guid? CurrentUserId()
    {
        var sub = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
        return Guid.TryParse(sub, out var id) ? id : null;
    }

    private string? CurrentUserName() =>
        User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Name)?.Value;
}
