namespace AuthService.Application.Exceptions;

public class NotFoundAppException(string message) : Exception(message);

public class ConflictAppException(string message) : Exception(message);

public class ValidationAppException(string message) : Exception(message);

/// <summary>The caller is authenticated and holds the general capability, but is not the specific
/// person allowed to act on this specific record — e.g. a checker who isn't the one assigned to this
/// approval request, or a maker attempting to approve their own request.</summary>
public class ForbiddenAppException(string message) : Exception(message);
