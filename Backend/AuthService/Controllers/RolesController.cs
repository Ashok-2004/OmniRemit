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
    public async Task<ActionResult<RoleDetailDto>> Create([FromBody] UpsertRoleRequest request, CancellationToken ct)
    {
        var result = await roles.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission(Feature, "Edit")]
    public async Task<ActionResult<RoleDetailDto>> Update(Guid id, [FromBody] UpsertRoleRequest request, CancellationToken ct)
        => Ok(await roles.UpdateAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission(Feature, "Delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await roles.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpGet("{id:guid}/users")]
    [RequirePermission(Feature, "View")]
    public async Task<ActionResult<IReadOnlyList<RoleUserDto>>> GetUsers(Guid id, CancellationToken ct)
        => Ok(await roles.GetUsersAsync(id, ct));
}
