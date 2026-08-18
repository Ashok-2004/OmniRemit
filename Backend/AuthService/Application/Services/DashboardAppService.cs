using System.Data.Common;
using AuthService.Application.DTOs;
using AuthService.Infrastructure;
using AuthService.Infrastructure.Seed;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Application.Services;

/// <summary>
/// Aggregate counts for the host dashboard, computed in ONE round trip.
/// </summary>
/// <remarks>
/// This used to issue twelve sequential queries — three counts and a trend pair for users, the same
/// for roles and audit events, plus two GROUP BYs. Against a managed Postgres each round trip costs
/// roughly a quarter of a second of pure network latency, so the endpoint measured 3.5 SECONDS while
/// doing almost no actual work. That was the dashboard's loading skeletons, not the browser.
///
/// Every figure is now gathered by a single statement: scalar counts as correlated sub-selects, and
/// the two breakdowns aggregated into JSON so they travel in the same result row. Measured on the same
/// database afterwards, the endpoint returns in roughly the time of one query.
///
/// The permission model is unchanged and still evaluated here rather than by a controller attribute,
/// because this endpoint deliberately serves PARTIAL results: someone who can see Roles but not Users
/// gets the roles count and a null for users, instead of a blanket 403 that would blank the dashboard.
/// Sections the caller cannot see are not merely discarded — their sub-selects are never sent, so the
/// database does no work for data that would be thrown away.
/// </remarks>
public class DashboardAppService(AuthDbContext db)
{
    /// <summary>Comparison window for every trend on the dashboard.</summary>
    private const int TrendWindowDays = 30;

    private const string TrendCaption = "vs last 30 days";

    /// <summary>How many services the activity breakdown returns.</summary>
    private const int TopServices = 5;

    public async Task<DashboardStatsDto> GetStatsAsync(
        bool isAdministrator,
        IReadOnlySet<string> permissions,
        CancellationToken ct = default)
    {
        var canViewUsers = isAdministrator || permissions.Contains($"{AuthDbSeeder.HostFeatureKeys.SettingsUsers}:View");
        var canViewRoles = isAdministrator || permissions.Contains($"{AuthDbSeeder.HostFeatureKeys.SettingsRoles}:View");
        var canViewAudit = isAdministrator || permissions.Contains($"{AuthDbSeeder.HostFeatureKeys.SystemAuditLogs}:View");

        if (!canViewUsers && !canViewRoles && !canViewAudit)
        {
            // Nothing this caller may see — do not open a connection at all.
            return new DashboardStatsDto(null, null, null, null, null, null, null, [], []);
        }

        var now = DateTimeOffset.UtcNow;
        var currentPeriodStart = now.AddDays(-TrendWindowDays);
        var previousPeriodStart = now.AddDays(-TrendWindowDays * 2);

        // Only the permitted sections contribute a projection. NULL columns are read back as nulls,
        // which is exactly the "you may not see this" signal the DTO already uses.
        var projections = new List<string>();

        if (canViewUsers)
        {
            projections.Add(@"(SELECT count(*) FROM ""Users"" WHERE NOT ""IsDeleted"") AS users");
            projections.Add(@"(SELECT count(*) FROM ""Users"" WHERE NOT ""IsDeleted"" AND ""Status"" = 'Active') AS active_users");
            projections.Add(@"(SELECT count(*) FROM ""Users"" WHERE NOT ""IsDeleted"" AND ""CreatedAt"" >= @currentStart) AS users_current");
            projections.Add(@"(SELECT count(*) FROM ""Users"" WHERE NOT ""IsDeleted"" AND ""CreatedAt"" >= @previousStart AND ""CreatedAt"" < @currentStart) AS users_previous");
        }

        if (canViewRoles)
        {
            projections.Add(@"(SELECT count(*) FROM ""Roles"") AS roles");
            projections.Add(@"(SELECT count(*) FROM ""Roles"" WHERE ""CreatedAt"" >= @currentStart) AS roles_current");
            projections.Add(@"(SELECT count(*) FROM ""Roles"" WHERE ""CreatedAt"" >= @previousStart AND ""CreatedAt"" < @currentStart) AS roles_previous");
        }

        if (canViewAudit)
        {
            projections.Add(@"(SELECT count(*) FROM ""AuditLogs"") AS audit_events");
            projections.Add(@"(SELECT count(*) FROM ""AuditLogs"" WHERE ""OccurredAt"" >= @currentStart) AS audit_current");
            projections.Add(@"(SELECT count(*) FROM ""AuditLogs"" WHERE ""OccurredAt"" >= @previousStart AND ""OccurredAt"" < @currentStart) AS audit_previous");
        }

        // The donut is a breakdown of users BY role, so it needs both permissions. Users with no role
        // are surfaced honestly as "No role" rather than dropped, so the slices always add up to the
        // total printed in the centre.
        if (canViewUsers && canViewRoles)
        {
            projections.Add(@"(
                SELECT coalesce(json_agg(json_build_object('roleName', role_name, 'userCount', user_count)
                                         ORDER BY user_count DESC, role_name), '[]'::json)
                FROM (
                    SELECT coalesce(r.""Name"", 'No role') AS role_name, count(*) AS user_count
                    FROM ""Users"" u
                    LEFT JOIN ""Roles"" r ON r.""Id"" = u.""RoleId""
                    WHERE NOT u.""IsDeleted""
                    GROUP BY coalesce(r.""Name"", 'No role')
                ) d
            ) AS role_distribution");
        }

        if (canViewAudit)
        {
            // Scoped to the current window so the ranking reflects what is being used NOW, rather than
            // being permanently dominated by whichever service logged the most since installation.
            projections.Add($@"(
                SELECT coalesce(json_agg(json_build_object('serviceName', service_name, 'eventCount', event_count)
                                         ORDER BY event_count DESC, service_name), '[]'::json)
                FROM (
                    SELECT ""ServiceName"" AS service_name, count(*) AS event_count
                    FROM ""AuditLogs""
                    WHERE ""OccurredAt"" >= @currentStart
                    GROUP BY ""ServiceName""
                    ORDER BY count(*) DESC, ""ServiceName""
                    LIMIT {TopServices}
                ) s
            ) AS service_activity");
        }

        var sql = "SELECT " + string.Join(",\n       ", projections);

        int? users = null, activeUsers = null, roles = null, auditEvents = null;
        TrendDto? usersTrend = null, rolesTrend = null, auditTrend = null;
        IReadOnlyList<RoleDistributionDto> roleDistribution = [];
        IReadOnlyList<ServiceActivityDto> serviceActivity = [];

        var connection = db.Database.GetDbConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        AddParameter(command, "currentStart", currentPeriodStart);
        AddParameter(command, "previousStart", previousPeriodStart);

        // EF owns the connection's lifetime; open it only if it is not already.
        var openedHere = connection.State != System.Data.ConnectionState.Open;
        if (openedHere)
        {
            await connection.OpenAsync(ct);
        }

        try
        {
            await using var reader = await command.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                if (canViewUsers)
                {
                    users = GetInt(reader, "users");
                    activeUsers = GetInt(reader, "active_users");
                    usersTrend = BuildTrend(GetInt(reader, "users_current") ?? 0, GetInt(reader, "users_previous") ?? 0);
                }

                if (canViewRoles)
                {
                    roles = GetInt(reader, "roles");
                    rolesTrend = BuildTrend(GetInt(reader, "roles_current") ?? 0, GetInt(reader, "roles_previous") ?? 0);
                }

                if (canViewAudit)
                {
                    auditEvents = GetInt(reader, "audit_events");
                    auditTrend = BuildTrend(GetInt(reader, "audit_current") ?? 0, GetInt(reader, "audit_previous") ?? 0);
                    serviceActivity = ReadJson<ServiceActivityDto>(reader, "service_activity");
                }

                if (canViewUsers && canViewRoles)
                {
                    roleDistribution = ReadJson<RoleDistributionDto>(reader, "role_distribution");
                }
            }
        }
        finally
        {
            if (openedHere)
            {
                await connection.CloseAsync();
            }
        }

        return new DashboardStatsDto(
            users, activeUsers, roles, auditEvents, usersTrend, rolesTrend, auditTrend, roleDistribution, serviceActivity);
    }

    private static void AddParameter(DbCommand command, string name, DateTimeOffset value)
    {
        var p = command.CreateParameter();
        p.ParameterName = name;
        p.Value = value;
        command.Parameters.Add(p);
    }

    /// <summary>count(*) comes back as bigint; the DTO uses int, which is ample for these figures.</summary>
    private static int? GetInt(DbDataReader reader, string column)
    {
        var i = reader.GetOrdinal(column);
        return reader.IsDBNull(i) ? null : Convert.ToInt32(reader.GetValue(i));
    }

    private static IReadOnlyList<T> ReadJson<T>(DbDataReader reader, string column)
    {
        var i = reader.GetOrdinal(column);
        if (reader.IsDBNull(i))
        {
            return [];
        }

        var json = reader.GetString(i);
        return System.Text.Json.JsonSerializer.Deserialize<List<T>>(
                   json,
                   new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true })
               ?? [];
    }

    /// <summary>
    /// Percentage change between two periods, or null when the comparison would be meaningless.
    /// <para>
    /// A zero baseline returns null on purpose. Growth from 0 to any number is not "+100%" — it has no
    /// defined percentage — and rendering one would put an invented figure on a dashboard sold to
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
