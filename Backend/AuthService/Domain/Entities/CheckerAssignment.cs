namespace AuthService.Domain.Entities;

/// <summary>
/// Maps one module to one checker. A module can have several rows (several eligible checkers) — see
/// ApprovalGatingService's least-current-workload selection for how one specific checker is picked per
/// request. A module is "gated" (Maker-Checker required) if and only if it has at least one row here;
/// this is what keeps every ungated module behaving exactly as it does today.
/// </summary>
public class CheckerAssignment
{
    public Guid Id { get; set; }
    public required string Module { get; set; }
    public Guid CheckerUserId { get; set; }
    public User? CheckerUser { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public Guid? CreatedBy { get; set; }
}
