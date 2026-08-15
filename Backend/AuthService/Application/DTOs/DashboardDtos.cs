namespace AuthService.Application.DTOs;

/// <summary>
/// Real aggregate counts for the host dashboard, permission-filtered per caller.
/// <para>
/// Each value is nullable, and null means "you do not have permission to see this" — deliberately
/// distinct from 0, which means "you can see it and it is genuinely zero". The dashboard renders a
/// null by omitting the card entirely rather than showing a fabricated zero.
/// </para>
/// <para>
/// This replaces three separate list calls the dashboard used to make (users, roles, apps) with
/// <c>pageSize=1</c> purely to read the <c>total</c> off each response. Each of those ran TWO
/// queries — a real COUNT plus a throwaway ORDER BY … LIMIT 1 whose row was discarded — so the
/// dashboard cost 3 HTTP round trips and 6 queries, three of them unindexed sorts, to render three
/// integers.
/// </para>
/// </summary>
public record DashboardStatsDto(
    int? Users,
    int? ActiveUsers,
    int? Roles);
