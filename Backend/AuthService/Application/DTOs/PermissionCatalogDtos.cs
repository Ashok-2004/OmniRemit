namespace AuthService.Application.DTOs;

public record CapabilityDto(string Key, string DisplayName);

/// <summary>
/// A grantable feature. <paramref name="Children"/> holds its sub-modules — the Role editor renders
/// each as a row of checkboxes under the parent. Empty for features with no sub-modules, including
/// every host feature and any remote still using the flat discovery contract.
/// </summary>
public record PermissionFeatureDto(
    Guid Id,
    string Key,
    string DisplayName,
    string Source,
    int SortOrder,
    IReadOnlyList<CapabilityDto> Capabilities,
    IReadOnlyList<PermissionFeatureDto> Children);

public record UpsertCapabilityRequest(string Key, string DisplayName, int SortOrder = 100);

/// <summary>One sub-module of a feature. Becomes a child PermissionFeature keyed "{parentKey}.{Key}".</summary>
public record UpsertModuleRequest(string Key, string DisplayName, int SortOrder, IReadOnlyList<UpsertCapabilityRequest> Capabilities);

public record UpsertPermissionFeatureRequest(
    string Key,
    string DisplayName,
    int SortOrder,
    IReadOnlyList<UpsertCapabilityRequest> Capabilities,
    IReadOnlyList<UpsertModuleRequest>? Modules = null);

public record DeactivatePermissionFeatureRequest(string Key);

public record ResyncPermissionFeaturesRequest(IReadOnlyList<UpsertPermissionFeatureRequest> Features);
