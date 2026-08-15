using AuthService.Application.DTOs;
using AuthService.Application.Services;
using AuthService.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

/// <summary>
/// Service-to-service surface. ModuleRegistry calls these to keep RemoteApp-sourced
/// PermissionFeature rows in sync whenever an admin registers, edits, removes, or bulk-resyncs
/// remote apps. Guarded by a shared static API key (X-Internal-Api-Key), not end-user JWTs.
/// </summary>
[ApiController]
[Route("internal/permission-features")]
[AllowAnonymous]
[TypeFilter(typeof(InternalApiKeyFilter))]
public class InternalController(PermissionCatalogAppService catalog) : ControllerBase
{
    [HttpPost("upsert")]
    public async Task<IActionResult> Upsert([FromBody] UpsertPermissionFeatureRequest request, CancellationToken ct)
    {
        await catalog.UpsertRemoteAppFeatureAsync(request.Key, request.DisplayName, request.SortOrder, request.Capabilities, ct);
        return NoContent();
    }

    [HttpPost("deactivate")]
    public async Task<IActionResult> Deactivate([FromBody] DeactivatePermissionFeatureRequest request, CancellationToken ct)
    {
        await catalog.DeactivateRemoteAppFeatureAsync(request.Key, ct);
        return NoContent();
    }

    [HttpPost("resync")]
    public async Task<IActionResult> Resync([FromBody] ResyncPermissionFeaturesRequest request, CancellationToken ct)
    {
        await catalog.ResyncRemoteAppFeaturesAsync(request.Features, ct);
        return NoContent();
    }
}
