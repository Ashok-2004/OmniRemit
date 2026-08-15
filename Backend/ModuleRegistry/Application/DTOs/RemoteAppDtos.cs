namespace ModuleRegistry.Application.DTOs;

public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public record CapabilityDto(string Key, string DisplayName);

public record RemoteAppDto(
    Guid Id,
    string Key,
    string DisplayName,
    string? IconKey,
    string ManifestUrl,
    int SidebarOrder,
    string Status,
    string? MaintenanceMessage,
    string PermissionFeatureKey,
    string? PermissionsSourceUrl,
    IReadOnlyList<CapabilityDto> Capabilities,
    string Health,
    DateTimeOffset? LastHealthCheckAt,
    string? LastHealthError,
    string? ContainerName,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record CreateRemoteAppRequest(string Key, string DisplayName, string? IconKey, string ManifestUrl, string? PermissionsSourceUrl = null, int SidebarOrder = 100);

public record UpdateRemoteAppRequest(string DisplayName, string? IconKey, string ManifestUrl, string? PermissionsSourceUrl, int SidebarOrder);

public record UpdateRemoteAppStatusRequest(string Status, string? MaintenanceMessage);

/// <summary>What the host's sidebar actually consumes — deliberately narrower than the admin DTO (no PermissionFeatureKey, timestamps, etc.).</summary>
public record SidebarAppDto(
    string Key,
    string DisplayName,
    string? IconKey,
    string ManifestUrl,
    int SidebarOrder,
    string Status,
    string? MaintenanceMessage,
    string Health,
    DateTimeOffset? LastHealthCheckAt);

/// <summary>
/// One entry in the platform health panel. Covers registered remote apps today; the shape is
/// deliberately generic so backend services can be folded in without a DTO change.
/// </summary>
public record HealthEntryDto(string Key, string DisplayName, string Health, DateTimeOffset? LastCheckedAt, string? Error);
