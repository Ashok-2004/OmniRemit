namespace AuthService.Application.DTOs;

public record CapabilityDto(string Key, string DisplayName);

public record PermissionFeatureDto(Guid Id, string Key, string DisplayName, string Source, int SortOrder, IReadOnlyList<CapabilityDto> Capabilities);

public record UpsertCapabilityRequest(string Key, string DisplayName, int SortOrder = 100);

public record UpsertPermissionFeatureRequest(string Key, string DisplayName, int SortOrder, IReadOnlyList<UpsertCapabilityRequest> Capabilities);

public record DeactivatePermissionFeatureRequest(string Key);

public record ResyncPermissionFeaturesRequest(IReadOnlyList<UpsertPermissionFeatureRequest> Features);
