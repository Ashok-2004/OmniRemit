namespace AuthService.Application.DTOs;

public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public record ProblemResponse(string Title, int Status);
