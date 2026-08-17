using AuthService.Application.DTOs;
using AuthService.Infrastructure;
using AuthService.Infrastructure.Seed;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Application.Services;

/// <summary>
/// Cross-entity search for the topbar command palette.
/// <para>
/// Results are filtered by the caller's capabilities <em>per entity type</em>, not by a single
/// blanket check. Someone who can view Roles but not Users gets role results and simply no user
/// results — search must never become a way to enumerate records the caller cannot otherwise open.
/// </para>
/// </summary>
public class SearchAppService(AuthDbContext db)
{
    /// <summary>Hard cap per group. The palette is a jump-to affordance, not a report.</summary>
    private const int PerGroupLimit = 5;

    public async Task<IReadOnlyList<SearchResultDto>> SearchAsync(
        string query,
        bool isAdministrator,
        IReadOnlySet<string> permissions,
        CancellationToken ct = default)
    {
        var term = query.Trim();
        if (term.Length < 2)
        {
            // Below two characters every result matches, which is noise rather than a search.
            return [];
        }

        var lowered = term.ToLowerInvariant();
        var results = new List<SearchResultDto>();

        if (isAdministrator || permissions.Contains($"{AuthDbSeeder.HostFeatureKeys.SettingsUsers}:View"))
        {
            var users = await db.Users
                .AsNoTracking()
                .Where(u => u.Name.ToLower().Contains(lowered) || u.Email.ToLower().Contains(lowered))
                .OrderBy(u => u.Name)
                .Take(PerGroupLimit)
                .Select(u => new SearchResultDto("User", u.Id.ToString(), u.Name, u.Email, $"/settings/users/{u.Id}"))
                .ToListAsync(ct);

            results.AddRange(users);
        }

        if (isAdministrator || permissions.Contains($"{AuthDbSeeder.HostFeatureKeys.SettingsRoles}:View"))
        {
            var roles = await db.Roles
                .AsNoTracking()
                .Where(r => r.Name.ToLower().Contains(lowered))
                .OrderBy(r => r.Name)
                .Take(PerGroupLimit)
                .Select(r => new SearchResultDto("Role", r.Id.ToString(), r.Name, r.Description, $"/settings/roles/{r.Id}"))
                .ToListAsync(ct);

            results.AddRange(roles);
        }

        return results;
    }
}
