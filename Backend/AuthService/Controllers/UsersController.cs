using AuthService.Application.DTOs;
using AuthService.Application.Services;
using AuthService.Infrastructure.Security;
using AuthService.Infrastructure.Seed;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController(UserAppService users) : ControllerBase
{
    private const string Feature = AuthDbSeeder.HostFeatureKeys.SettingsUsers;

    [HttpGet]
    [RequirePermission(Feature, "View")]
    public async Task<ActionResult<PagedResult<UserListItemDto>>> List(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25,
        [FromQuery] string? search = null, [FromQuery] bool? isActive = null, [FromQuery] Guid? roleId = null,
        CancellationToken ct = default)
        => Ok(await users.ListAsync(Math.Max(page, 1), Math.Clamp(pageSize, 1, 100), search, isActive, roleId, ct));

    [HttpGet("{id:guid}")]
    [RequirePermission(Feature, "View")]
    public async Task<ActionResult<UserDetailDto>> Get(Guid id, CancellationToken ct)
        => Ok(await users.GetAsync(id, ct));

    [HttpPost]
    [RequirePermission(Feature, "Create")]
    public async Task<ActionResult<CreateUserResponse>> Create([FromBody] CreateUserRequest request, CancellationToken ct)
    {
        var result = await users.CreateAsync(request, CurrentUserId(), ct);
        return CreatedAtAction(nameof(Get), new { id = result.User.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission(Feature, "Edit")]
    public async Task<ActionResult<UserDetailDto>> Update(Guid id, [FromBody] UpdateUserRequest request, CancellationToken ct)
        => Ok(await users.UpdateAsync(id, request, CurrentUserId(), ct));

    [HttpPatch("{id:guid}/status")]
    [RequirePermission(Feature, "Edit")]
    public async Task<ActionResult<UserDetailDto>> UpdateStatus(Guid id, [FromBody] UpdateUserStatusRequest request, CancellationToken ct)
        => Ok(await users.UpdateStatusAsync(id, request.IsActive, CurrentUserId(), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission(Feature, "Delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await users.DeleteAsync(id, CurrentUserId(), ct);
        return NoContent();
    }

    [HttpGet("{id:guid}/permission-overrides")]
    [RequirePermission(Feature, "View")]
    public async Task<ActionResult<IReadOnlyList<PermissionOverrideDto>>> GetOverrides(Guid id, CancellationToken ct)
        => Ok(await users.GetPermissionOverridesAsync(id, ct));

    [HttpPut("{id:guid}/permission-overrides")]
    [RequirePermission(Feature, "Edit")]
    public async Task<ActionResult<IReadOnlyList<PermissionOverrideDto>>> ReplaceOverrides(
        Guid id, [FromBody] UpdateUserPermissionOverridesRequest request, CancellationToken ct)
        => Ok(await users.ReplacePermissionOverridesAsync(id, request.Overrides, CurrentUserId(), ct));

    private Guid? CurrentUserId()
    {
        var sub = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
        return Guid.TryParse(sub, out var id) ? id : null;
    }
}
