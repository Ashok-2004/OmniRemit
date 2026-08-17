using System.Text.Json;
using AuthService.Application.DTOs;
using AuthService.Application.Services;
using AuthService.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

[ApiController]
[Route("api/search")]
[Authorize]
public class SearchController(SearchAppService search) : ControllerBase
{
    /// <summary>
    /// Cross-entity search for the command palette.
    /// <para>
    /// No [RequirePermission] on purpose — the service filters each entity type against the caller's
    /// own capabilities, so a partial-access user gets partial results rather than a blanket 403.
    /// </para>
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SearchResultDto>>> Search(
        [FromQuery] string q,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return Ok(Array.Empty<SearchResultDto>());
        }

        var isAdministrator = User.FindFirst(JwtTokenService.AdministratorClaimType)?.Value == "true";
        var permsClaim = User.FindFirst(JwtTokenService.PermissionsClaimType)?.Value;
        var permissions = string.IsNullOrEmpty(permsClaim)
            ? new HashSet<string>()
            : (JsonSerializer.Deserialize<string[]>(permsClaim) ?? []).ToHashSet();

        return Ok(await search.SearchAsync(q, isAdministrator, permissions, ct));
    }
}
