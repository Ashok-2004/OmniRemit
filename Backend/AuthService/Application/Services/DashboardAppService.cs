using AuthService.Application.DTOs;
using AuthService.Domain.Enums;
using AuthService.Infrastructure;
using AuthService.Infrastructure.Seed;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Application.Services;

/// <summary>
/// Aggregate counts for the host dashboard, computed as real server-side COUNTs in a single request.
/// </summary>
public class DashboardAppService(AuthDbContext db)
{
    /// <summary>
    /// Returns only the counts the caller is permitted to see. Permission is evaluated here rather
    /// than by a controller-level [RequirePermission] because this endpoint intentionally serves
    /// partial results — a user who can see Roles but not Users gets the Roles count and a null for
    /// Users, instead of a blanket 403 that would blank the whole dashboard.
    /// </summary>
    public async Task<DashboardStatsDto> GetStatsAsync(
        bool isAdministrator,
        IReadOnlySet<string> permissions,
        CancellationToken ct = default)
    {
        var canViewUsers = isAdministrator || permissions.Contains($"{AuthDbSeeder.HostFeatureKeys.SettingsUsers}:View");
        var canViewRoles = isAdministrator || permissions.Contains($"{AuthDbSeeder.HostFeatureKeys.SettingsRoles}:View");

        int? users = null;
        int? activeUsers = null;
        int? roles = null;

        if (canViewUsers)
        {
            // The global query filter already excludes soft-deleted users, so these are honest totals.
            users = await db.Users.CountAsync(ct);
            activeUsers = await db.Users.CountAsync(u => u.Status == UserStatus.Active, ct);
        }

        if (canViewRoles)
        {
            roles = await db.Roles.CountAsync(ct);
        }

        return new DashboardStatsDto(users, activeUsers, roles);
    }
}
