namespace AuthService.Application.Exceptions;

public class NotFoundAppException(string message) : Exception(message);

public class ConflictAppException(string message) : Exception(message);

public class ValidationAppException(string message) : Exception(message);
