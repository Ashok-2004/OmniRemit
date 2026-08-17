namespace AuthService.Application.DTOs;

/// <summary>
/// One command-palette hit. <paramref name="Type"/> groups results in the UI;
/// <paramref name="Route"/> is the host-relative path to open, so the frontend never has to
/// reconstruct URLs per entity type.
/// </summary>
public record SearchResultDto(string Type, string Id, string Title, string? Subtitle, string Route);
