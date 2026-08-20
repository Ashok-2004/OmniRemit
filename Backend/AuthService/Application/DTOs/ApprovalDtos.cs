using System.ComponentModel.DataAnnotations;

namespace AuthService.Application.DTOs;

/// <summary>
/// Plain string constants, not an enum — Phase 2 adds new module keys (Applications, Customer360
/// FieldConfig, Lead Management Config) with zero schema/migration impact. Only Users/Roles are
/// actually enforced in Phase 1; the rest exist so the Checker Assignment admin page can list every
/// module from day one (with a "not yet enforced" indicator on the ones not wired yet).
/// </summary>
public static class ApprovalModuleKeys
{
    public const string Users = "Users";
    public const string Roles = "Roles";

    // Phase 2 — reserved, not yet enforced by any backend gating check.
    public const string Applications = "Applications";
    public const string Customer360FieldConfig = "Customer360.FieldConfig";
    public const string LeadManagementConfig = "LeadManagement.Config";

    /// <summary>Every module key the Checker Assignment UI should list, in display order.</summary>
    public static readonly string[] All =
    [
        Users, Roles, Applications, Customer360FieldConfig, LeadManagementConfig,
    ];

    /// <summary>Modules Phase 1 actually gates. Anything else in <see cref="All"/> is UI-visible but inert.</summary>
    public static readonly string[] EnforcedInPhase1 = [Users, Roles];
}

public static class ApprovalActionKeys
{
    public const string Create = "Create";
    public const string Update = "Update";
    public const string Delete = "Delete";
    public const string Enable = "Enable";
    public const string Disable = "Disable";
}

public static class ApprovalStatus
{
    public const string Pending = "Pending";
    public const string Approved = "Approved";
    public const string Rejected = "Rejected";
}

public record ApprovalRequestListItemDto(
    Guid Id, string Module, string Action, string? EntityType, string? EntityLabel,
    string Status, Guid MakerId, string? MakerName, Guid CheckerId, string? CheckerName,
    DateTimeOffset RequestedAt, DateTimeOffset? DecidedAt, string? RejectionReason);

public record ApprovalRequestDetailDto(
    Guid Id, string Module, string Action, string? EntityType, string? EntityId, string? EntityLabel,
    string? OldDataJson, string NewDataJson, string Status,
    Guid MakerId, string? MakerName, Guid CheckerId, string? CheckerName,
    DateTimeOffset RequestedAt, DateTimeOffset? DecidedAt, string? RejectionReason);

/// <summary>Real DB aggregates for the Approval Center's summary cards — never client-derived from a partial page of rows.</summary>
public record ApprovalSummaryDto(int PendingTotal, int ApprovedToday, int RejectedToday, int AssignedToMePending);

public record RejectApprovalRequest(
    [Required(AllowEmptyStrings = false, ErrorMessage = "A rejection reason is required.")]
    [MaxLength(1000, ErrorMessage = "Rejection reason cannot exceed 1000 characters.")]
    string Reason);

/// <summary>Returned instead of the normal success body whenever a mutation was gated and could not be
/// applied directly. HTTP 202 Accepted.</summary>
public record ApprovalPendingDto(
    Guid ApprovalRequestId, string Module, string Action, string CheckerName,
    string Message = "Request submitted for approval.");

/// <summary>
/// Wraps every gated UserAppService/RoleAppService mutation result. Exactly one of the two is set —
/// <see cref="Applied"/> for the ungated (today's-behavior) path, <see cref="Pending"/> for the gated
/// path. Controllers unwrap this back into the original 200/201/204 response shape for the ungated
/// case, so no existing consumer sees any change; only the gated case gets the new 202 shape.
/// </summary>
public record MutationResult<T>(T? Applied, ApprovalPendingDto? Pending)
{
    public static MutationResult<T> Ok(T applied) => new(applied, null);
    public static MutationResult<T> PendingApproval(ApprovalPendingDto pending) => new(default, pending);
}

public record CheckerAssignmentDto(Guid Id, string Module, Guid CheckerUserId, string CheckerName, DateTimeOffset CreatedAt);

public record UpsertCheckerAssignmentRequest(
    [Required(AllowEmptyStrings = false, ErrorMessage = "Module is required.")]
    string Module,
    [Required(ErrorMessage = "A checker user is required.")]
    Guid CheckerUserId);
