namespace ModuleRegistry.Application.Exceptions;

public class NotFoundAppException(string message) : Exception(message);

public class ConflictAppException(string message) : Exception(message);

public class ValidationAppException(string message) : Exception(message);

/// <summary>
/// Thrown when a Maker-Checker gating check (IsGatedAsync/SubmitApprovalAsync) can't be verified
/// because AuthService is unreachable. Deliberately NOT best-effort like the audit-log/permission-sync
/// calls elsewhere in AuthServiceClient — proceeding to mutate when gating status is unknown would be a
/// silent Maker-Checker bypass, so this must block the request rather than get logged and swallowed.
/// </summary>
public class ApprovalServiceUnavailableAppException(string message) : Exception(message);
