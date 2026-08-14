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
    [HttpGet("catalog")]
    public async Task<ActionResult<IReadOnlyList<PermissionFeatureDto>>> GetCatalog([FromQuery] bool activeOnly = true, CancellationToken ct = default)
        => Ok(await catalog.GetCatalogAsync(activeOnly, ct));

    [HttpGet("capabilities")]
    public ActionResult<IReadOnlyList<string>> GetCapabilities() => Ok(PermissionCatalogAppService.GetCapabilities());
}
