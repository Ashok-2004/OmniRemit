namespace AuthService.Application.DTOs;

public record PermissionFeatureDto(Guid Id, string Key, string DisplayName, string Source, int SortOrder);

public record UpsertPermissionFeatureRequest(string Key, string DisplayName, int SortOrder = 100);

public record DeactivatePermissionFeatureRequest(string Key);

public record ResyncPermissionFeaturesRequest(IReadOnlyList<UpsertPermissionFeatureRequest> Features);
