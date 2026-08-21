namespace AuthService.Application.Exceptions;

public class NotFoundAppException(string message) : Exception(message);

public class ConflictAppException(string message) : Exception(message);

public class ValidationAppException(string message) : Exception(message);

/// <summary>The caller is authenticated and holds the general capability, but is not the specific
/// person allowed to act on this specific record — e.g. a checker who isn't the one assigned to this
/// approval request, or a maker attempting to approve their own request.</summary>
public class ForbiddenAppException(string message) : Exception(message);

/// <summary>The resource genuinely existed and is permanently gone by design — not "not found"
/// (which implies it may never have existed) and not "conflict" (which implies retrying
/// differently could work). Today: a one-time secret that has already been collected.</summary>
public class GoneAppException(string message) : Exception(message);
