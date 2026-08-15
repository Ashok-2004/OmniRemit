namespace EmployeeService.DTOs.Requests;

/// <summary>
/// Server-side paging/search/sort for the employee roster.
/// <para>
/// The list endpoint previously returned <c>_context.Employees.ToListAsync()</c> — every row, every
/// column, change-tracked, then mapped in memory. That is fine against a handful of seed rows and
/// falls over on a real roster, so paging is enforced here rather than left to the caller.
/// </para>
/// </summary>
public class EmployeeQuery
{
    private const int MaxPageSize = 100;

    private int _page = 1;
    private int _pageSize = 25;

    /// <summary>1-based. Values below 1 are clamped rather than rejected — a bad page number is not worth a 400.</summary>
    public int Page
    {
        get => _page;
        set => _page = value < 1 ? 1 : value;
    }

    /// <summary>Clamped to [1, 100] so a caller cannot request the whole table by passing a huge value.</summary>
    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value switch
        {
            < 1 => 1,
            > MaxPageSize => MaxPageSize,
            _ => value,
        };
    }

    /// <summary>Free-text match across name, email and department. Null/blank means no filter.</summary>
    public string? Search { get; set; }

    /// <summary>One of: name, email, department, salary. Anything else falls back to name.</summary>
    public string? SortBy { get; set; }

    /// <summary>True for descending. Defaults to ascending.</summary>
    public bool SortDesc { get; set; }
}
