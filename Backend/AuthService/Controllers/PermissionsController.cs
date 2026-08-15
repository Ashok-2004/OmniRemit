using AuthService.Application.DTOs;
using AuthService.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

[ApiController]
[Route("api/permissions")]
[Authorize]
public class PermissionsController(PermissionCatalogAppService catalog) : ControllerBase
{
    /// <summary>Every feature with its own dynamically-declared capabilities embedded — the Role editor and User override editor render exactly this, per feature, nothing hardcoded.</summary>
    [HttpGet("catalog")]
    public async Task<ActionResult<IReadOnlyList<PermissionFeatureDto>>> GetCatalog([FromQuery] bool activeOnly = true, CancellationToken ct = default)
        => Ok(await catalog.GetCatalogAsync(activeOnly, ct));
}
