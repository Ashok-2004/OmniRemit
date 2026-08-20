namespace AuthService.Domain.Entities;

/// <summary>
/// One Maker-Checker approval request. The single source of truth for the whole platform — AuthService
/// is the only place these are stored, mirroring exactly how AuditLog centralizes every service's audit
/// trail (see AuditLog.cs's own doc comment). A gated mutation never actually applies; instead one of
/// these rows is written, and the real mutation is replayed only once a checker approves it.
/// </summary>
public class ApprovalRequest
{
    public Guid Id { get; set; }

    /// <summary>Which module this request targets — a curated string (see ApprovalModuleKeys), not an
    /// enum, so a future module slots in with zero schema change.</summary>
    public required string Module { get; set; }

    /// <summary>Create / Update / Delete / Enable / Disable — see ApprovalActionKeys.</summary>
    public required string Action { get; set; }

    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public string? EntityLabel { get; set; }

    /// <summary>JSON snapshot of the entity's state before this change. Null for Create.</summary>
    public string? OldDataJson { get; set; }

    /// <summary>JSON of the request DTO the maker submitted.</summary>
    public required string NewDataJson { get; set; }

    /// <summary>Pending / Approved / Rejected.</summary>
    public required string Status { get; set; }

    public Guid MakerId { get; set; }
    /// <summary>Denormalized snapshot of the maker's name at request time — survives the maker account later being deleted.</summary>
    public string? MakerName { get; set; }

    /// <summary>The ONE specific checker auto-assigned at creation (least-current-workload selection). Only this
    /// user — not just any checker of the module — may approve or reject this particular request.</summary>
    public Guid CheckerId { get; set; }
    public string? CheckerName { get; set; }

    public DateTimeOffset RequestedAt { get; set; }
    public DateTimeOffset? DecidedAt { get; set; }
    public string? RejectionReason { get; set; }

    // ---- Phase 2 hooks — populated only by AuthService itself in Phase 1, left inert otherwise ----

    /// <summary>Which service originated this request. Always "AuthService" in Phase 1; Phase 2 remote
    /// services (ModuleRegistry, EmployeeService, LeadService, Customer360Service) populate their own name.</summary>
    public string SourceService { get; set; } = "AuthService";

    /// <summary>Phase 2: an internal-API-key-protected URL the origin remote service exposes to receive
    /// the approve/reject outcome and actually apply it. Null in Phase 1 — the mutation is replayed
    /// in-process instead, since AuthService owns Users/Roles directly.</summary>
    public string? CallbackUrl { get; set; }

    public string? CorrelationId { get; set; }
}
