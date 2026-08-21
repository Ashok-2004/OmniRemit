namespace LeadManagement.Api.Infrastructure;

/// <summary>
/// Thrown when a Maker-Checker gating check (IsGatedAsync/SubmitApprovalAsync) can't be verified
/// because AuthService is unreachable. Deliberately NOT best-effort like the audit-log push elsewhere in
/// AuthServiceClient — proceeding to mutate when gating status is unknown would be a silent
/// Maker-Checker bypass, so this must block the request (mapped to 503 by ExceptionMiddleware) rather
/// than get logged and swallowed.
/// </summary>
public class ApprovalServiceUnavailableException(string message) : Exception(message);
