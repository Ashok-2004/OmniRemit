using AuthService.Application.DTOs;
using AuthService.Application.Services;
using AuthService.Infrastructure.Security;
using AuthService.Infrastructure.Seed;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

[ApiController]
[Route("api/roles")]
[Authorize]
public class RolesController(RoleAppService roles) : ControllerBase
{
    private const string Feature = AuthDbSeeder.HostFeatureKeys.SettingsRoles;

    [HttpGet]
    [RequirePermission(Feature, "View")]
    public async Task<ActionResult<PagedResult<RoleListItemDto>>> List(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25, [FromQuery] string? search = null, CancellationToken ct = default)
        => Ok(await roles.ListAsync(Math.Max(page, 1), Math.Clamp(pageSize, 1, 100), search, ct));

    [HttpGet("{id:guid}")]
    [RequirePermission(Feature, "View")]
    public async Task<ActionResult<RoleDetailDto>> Get(Guid id, CancellationToken ct)
        => Ok(await roles.GetAsync(id, ct));

    [HttpPost]
    [RequirePermission(Feature, "Create")]
    public async Task<IActionResult> Create([FromBody] UpsertRoleRequest request, CancellationToken ct)
    {
        var result = await roles.CreateAsync(request, CurrentUserId(), ct, bypassApproval: IsSuperAdmin());
        if (result.Applied is not null)
        {
            return CreatedAtAction(nameof(Get), new { id = result.Applied.Id }, result.Applied);
        }
        return Accepted(result.Pending);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission(Feature, "Edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertRoleRequest request, CancellationToken ct)
    {
        var result = await roles.UpdateAsync(id, request, CurrentUserId(), ct, bypassApproval: IsSuperAdmin());
        return result.Applied is not null ? Ok(result.Applied) : Accepted(result.Pending);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission(Feature, "Delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var pending = await roles.DeleteAsync(id, CurrentUserId(), ct, bypassApproval: IsSuperAdmin());
        return pending is null ? NoContent() : Accepted(pending);
    }

    [HttpGet("{id:guid}/users")]
    [RequirePermission(Feature, "View")]
    public async Task<ActionResult<RoleUsersDto>> GetUsers(Guid id, [FromQuery] int limit = 50, CancellationToken ct = default)
        => Ok(await roles.GetUsersAsync(id, limit, ct));

    private Guid? CurrentUserId()
    {
        var sub = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
        return Guid.TryParse(sub, out var id) ? id : null;
    }

    /// <summary>
    /// Super Admin bypass predicate for the Maker-Checker gate. Deliberately the strict single-claim
    /// check — the exact claim AuthService issues — not a wider admin test, so the population that
    /// skips assignment is identical across every service that has one of these helpers.
    /// </summary>
    private bool IsSuperAdmin() => User.FindFirst(JwtTokenService.AdministratorClaimType)?.Value == "true";
}
