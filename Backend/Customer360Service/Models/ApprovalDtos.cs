namespace backend.Models
{
    /// <summary>Returned instead of the normal success body whenever a mutation was gated and could not
    /// be applied directly. Mirrors AuthService's own ApprovalPendingDto shape field-for-field — the
    /// host frontend's isApprovalPending() type guard reads approvalRequestId/message off whatever any
    /// service returns, so the JSON shape matters even without a shared package.</summary>
    public class ApprovalPendingDto
    {
        public Guid ApprovalRequestId { get; set; }
        public string Module { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string CheckerName { get; set; } = string.Empty;
        public string Message { get; set; } = "Request submitted for approval.";
    }

    /// <summary>Wraps every gated FieldConfigService mutation result. Exactly one of the two is set —
    /// so the ungated JSON response stays identical to today.</summary>
    public class MutationResult<T>
    {
        public T? Applied { get; set; }
        public ApprovalPendingDto? Pending { get; set; }

        public static MutationResult<T> Ok(T applied) => new() { Applied = applied };
        public static MutationResult<T> PendingApproval(ApprovalPendingDto pending) => new() { Pending = pending };
    }

    /// <summary>Payload AuthService POSTs to internal/approvals/apply to replay an approved mutation
    /// that originated here. Mirrors AuthService's own ApplyApprovedMutationRequest field-for-field.</summary>
    public class ApplyApprovedMutationRequest
    {
        public string Module { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string? EntityType { get; set; }
        public string? EntityId { get; set; }
        public string NewDataJson { get; set; } = string.Empty;
        public Guid ActingUserId { get; set; }
        public string? ActingUserName { get; set; }
        public string? CorrelationId { get; set; }
    }
}
