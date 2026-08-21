namespace ModuleRegistry.Application.DTOs;

/// <summary>Returned instead of the normal success body whenever a mutation was gated and could not be
/// applied directly. HTTP 202 Accepted. Mirrors AuthService's own ApprovalPendingDto shape exactly — no
/// shared package, but the JSON shape matters: the host frontend's isApprovalPending() type guard reads
/// approvalRequestId/message off whatever this service returns, same as it does for AuthService.</summary>
public record ApprovalPendingDto(
    Guid ApprovalRequestId, string Module, string Action, string CheckerName,
    string Message = "Request submitted for approval.");

/// <summary>Wraps every gated RemoteAppAppService mutation result. Exactly one of the two is set —
/// <see cref="Applied"/> for the ungated (today's-behavior) path, <see cref="Pending"/> for the gated
/// path — so the ungated JSON response stays byte-for-byte identical to today.</summary>
public record MutationResult<T>(T? Applied, ApprovalPendingDto? Pending)
{
    public static MutationResult<T> Ok(T applied) => new(applied, null);
    public static MutationResult<T> PendingApproval(ApprovalPendingDto pending) => new(default, pending);
}

/// <summary>Payload AuthService POSTs to internal/approvals/apply to replay an approved mutation that
/// originated here. Mirrors AuthService's own ApplyApprovedMutationRequest field-for-field.</summary>
public record ApplyApprovedMutationRequest(
    string Module, string Action, string? EntityType, string? EntityId, string NewDataJson,
    Guid ActingUserId, string? ActingUserName, string? CorrelationId);
