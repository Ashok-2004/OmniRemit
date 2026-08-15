namespace AuthService.Application.DTOs;

public record AuditLogDto(
    Guid Id,
    DateTimeOffset OccurredAt,
    string ServiceName,
    Guid? ActorUserId,
    string? ActorName,
    string Action,
    string? EntityType,
    string? EntityId,
    string? Details);

/// <summary>What any service (ModuleRegistry, EmployeeService, any future remote's backend) posts to record one audit entry.</summary>
public record RecordAuditLogRequest(
    string ServiceName,
    Guid? ActorUserId,
    string? ActorName,
    string Action,
    string? EntityType,
    string? EntityId,
    string? Details);
