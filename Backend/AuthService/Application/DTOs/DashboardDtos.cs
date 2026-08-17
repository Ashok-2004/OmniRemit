namespace AuthService.Application.DTOs;

/// <summary>
/// Period-over-period change for a stat card.
/// <para>
/// Only produced when there is a real baseline to compare against. When the previous period had no
/// records at all, any percentage would be meaningless (every increase from zero is "infinite", not
/// "+100%"), so the service returns null and the card renders without a trend rather than showing a
/// fabricated figure.
/// </para>
/// </summary>
/// <param name="Percent">Whole-number percentage change. Negative means a decline.</param>
/// <param name="Caption">What the comparison is against, e.g. "vs last 30 days".</param>
public record TrendDto(int Percent, string Caption);

/// <summary>One slice of the users-by-role donut. Comes from a real GROUP BY over role assignments.</summary>
public record RoleDistributionDto(string RoleName, int UserCount);

/// <summary>
/// Recorded activity per service, for the dashboard's ranked bar list.
/// <para>
/// Ranked by audit-event volume rather than the reference design's "active users per application",
/// because nothing in this system records per-application user activity — that figure would have to
/// be invented. Event volume is a real, already-captured measure of which parts of the platform are
/// actually being used.
/// </para>
/// </summary>
public record ServiceActivityDto(string ServiceName, int EventCount);

/// <summary>
/// Real aggregate counts for the host dashboard, permission-filtered per caller.
/// <para>
/// Each count is nullable, and null means "you do not have permission to see this" — deliberately
/// distinct from 0, which means "you can see it and it is genuinely zero". The dashboard renders a
/// null by omitting the card entirely rather than showing a fabricated zero.
/// </para>
/// </summary>
public record DashboardStatsDto(
    int? Users,
    int? ActiveUsers,
    int? Roles,
    int? AuditEvents,
    TrendDto? UsersTrend,
    TrendDto? RolesTrend,
    TrendDto? AuditEventsTrend,
    IReadOnlyList<RoleDistributionDto> RoleDistribution,
    IReadOnlyList<ServiceActivityDto> ServiceActivity);
