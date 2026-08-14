namespace AuthService.Domain.Enums;

/// <summary>
/// A single grantable action within a permission feature. Not every feature exposes every
/// capability (e.g. "Dashboard" only ever exposes View) — which capabilities apply to which
/// feature is a frontend/catalog concern, this enum just enumerates the full possible set.
/// </summary>
public enum CapabilityType
{
    View = 0,
    Create = 1,
    Edit = 2,
    Delete = 3,
    Import = 4,
    Export = 5,
}
