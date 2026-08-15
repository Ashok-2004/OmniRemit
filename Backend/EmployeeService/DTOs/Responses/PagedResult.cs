namespace EmployeeService.DTOs.Responses;

/// <summary>
/// A page of results plus the total row count, so a client can render pagination without a second
/// request. Shape deliberately mirrors ModuleRegistry's and AuthService's PagedResult so every list
/// endpoint on the platform looks the same to a consumer.
/// </summary>
public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);
