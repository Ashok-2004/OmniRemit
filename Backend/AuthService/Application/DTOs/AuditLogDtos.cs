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
    string? Details,
    string? SourceIp,
    string? AuthMethod,
    string Result,
    string? UserAgent,
    string? FailureReason,
    string CorrelationId);

/// <summary>What any service (ModuleRegistry, EmployeeService, any future remote's backend) posts to record one audit entry.</summary>
public record RecordAuditLogRequest(
    string ServiceName,
    Guid? ActorUserId,
    string? ActorName,
    string Action,
    string? EntityType,
    string? EntityId,
    string? Details,
    string? AuthMethod = null,
    string Result = "Success",
    string? UserAgent = null,
    string? FailureReason = null,
    string? CorrelationId = null);

/// <summary>Real aggregate counts over a date range — backs the Audit Logs page's summary cards. Never client-derived from a partial page of rows.</summary>
public record AuditLogSummaryDto(
    int LoginSuccesses,
    int LoginErrors,
    int TotalAuditEvents,
    int ActiveUsers);
