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
    /// <summary>Comparison window for every trend on the dashboard.</summary>
    private const int TrendWindowDays = 30;

    private const string TrendCaption = "vs last 30 days";

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
        var canViewAudit = isAdministrator || permissions.Contains($"{AuthDbSeeder.HostFeatureKeys.SystemAuditLogs}:View");

        var now = DateTimeOffset.UtcNow;
        var currentPeriodStart = now.AddDays(-TrendWindowDays);
        var previousPeriodStart = now.AddDays(-TrendWindowDays * 2);

        int? users = null;
        int? activeUsers = null;
        int? roles = null;
        int? auditEvents = null;
        TrendDto? usersTrend = null;
        TrendDto? rolesTrend = null;
        TrendDto? auditTrend = null;
        IReadOnlyList<RoleDistributionDto> roleDistribution = [];
        IReadOnlyList<ServiceActivityDto> serviceActivity = [];

        if (canViewUsers)
        {
            // The global query filter already excludes soft-deleted users, so these are honest totals.
            users = await db.Users.CountAsync(ct);
            activeUsers = await db.Users.CountAsync(u => u.Status == UserStatus.Active, ct);

            var createdThisPeriod = await db.Users.CountAsync(u => u.CreatedAt >= currentPeriodStart, ct);
            var createdLastPeriod = await db.Users
                .CountAsync(u => u.CreatedAt >= previousPeriodStart && u.CreatedAt < currentPeriodStart, ct);

            usersTrend = BuildTrend(createdThisPeriod, createdLastPeriod);
        }

        if (canViewRoles)
        {
            roles = await db.Roles.CountAsync(ct);

            var rolesThisPeriod = await db.Roles.CountAsync(r => r.CreatedAt >= currentPeriodStart, ct);
            var rolesLastPeriod = await db.Roles
                .CountAsync(r => r.CreatedAt >= previousPeriodStart && r.CreatedAt < currentPeriodStart, ct);

            rolesTrend = BuildTrend(rolesThisPeriod, rolesLastPeriod);
        }

        // The donut needs users AND roles — it is a breakdown of one by the other.
        if (canViewUsers && canViewRoles)
        {
            // Real GROUP BY. Users with no role are surfaced honestly as "No role" rather than
            // dropped, so the slices always add up to the total shown in the centre.
            var grouped = await db.Users
                .AsNoTracking()
                .GroupBy(u => u.Role != null ? u.Role.Name : "No role")
                .Select(g => new RoleDistributionDto(g.Key, g.Count()))
                .ToListAsync(ct);

            roleDistribution = grouped.OrderByDescending(r => r.UserCount).ThenBy(r => r.RoleName).ToList();
        }

        if (canViewAudit)
        {
            auditEvents = await db.AuditLogs.CountAsync(ct);

            var auditThisPeriod = await db.AuditLogs.CountAsync(a => a.OccurredAt >= currentPeriodStart, ct);
            var auditLastPeriod = await db.AuditLogs
                .CountAsync(a => a.OccurredAt >= previousPeriodStart && a.OccurredAt < currentPeriodStart, ct);

            auditTrend = BuildTrend(auditThisPeriod, auditLastPeriod);

            // Scoped to the current window so the ranking reflects what is being used NOW, rather
            // than being permanently dominated by whichever service happened to log the most since
            // the platform was first installed.
            var activity = await db.AuditLogs
                .AsNoTracking()
                .Where(a => a.OccurredAt >= currentPeriodStart)
                .GroupBy(a => a.ServiceName)
                .Select(g => new ServiceActivityDto(g.Key, g.Count()))
                .ToListAsync(ct);

            serviceActivity = activity.OrderByDescending(s => s.EventCount).ThenBy(s => s.ServiceName).Take(5).ToList();
        }

        return new DashboardStatsDto(
            users, activeUsers, roles, auditEvents, usersTrend, rolesTrend, auditTrend, roleDistribution, serviceActivity);
    }

    /// <summary>
    /// Percentage change between two periods, or null when the comparison would be meaningless.
    /// <para>
    /// A zero baseline returns null on purpose. Growth from 0 to any number is not "+100%" — it has
    /// no defined percentage — and rendering one would put an invented figure on a dashboard sold to
    /// banks. The card simply shows no trend in that case.
    /// </para>
    /// </summary>
    private static TrendDto? BuildTrend(int current, int previous)
    {
        if (previous <= 0)
        {
            return null;
        }

        var percent = (int)Math.Round((current - previous) / (double)previous * 100);
        return new TrendDto(percent, TrendCaption);
    }
}
