namespace EmployeeService.DTOs.Responses;

/// <summary>
/// One page of employees plus real aggregates over the WHOLE filtered set.
/// <para>
/// The aggregates are computed server-side on purpose. The remote's dashboard previously derived
/// its "Total Employees", "Departments" and "Average Salary" tiles from the full array it had in
/// memory — which was correct only because the API returned every row. Once the list is paged, the
/// same client-side maths would silently start reporting "stats for the 25 rows currently on
/// screen" while still being labelled as totals. Returning them from the server keeps the tiles
/// truthful regardless of page size.
/// </para>
/// </summary>
public record EmployeeListResult(
    IReadOnlyList<EmployeeResponse> Items,
    int Total,
    int Page,
    int PageSize,
    int DepartmentCount,
    decimal AverageSalary);
