using System.Net.Mime;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace LeadManagement.Api.Middleware;

/// <summary>
/// Top-level exception middleware that ensures unhandled errors return safe RFC 7807 ProblemDetails
/// and keep CORS headers intact, preventing browser-level opaque CORS errors.
/// </summary>
public class ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception processing request {Method} {Path}", context.Request.Method, context.Request.Path);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        if (context.Response.HasStarted)
        {
            return;
        }

        context.Response.ContentType = MediaTypeNames.Application.Json;
        context.Response.StatusCode = exception switch
        {
            KeyNotFoundException => StatusCodes.Status404NotFound,
            ArgumentException or InvalidOperationException => StatusCodes.Status400BadRequest,
            UnauthorizedAccessException => StatusCodes.Status401Unauthorized,
            _ => StatusCodes.Status500InternalServerError
        };

        var problem = new ProblemDetails
        {
            Status = context.Response.StatusCode,
            Title = exception switch
            {
                KeyNotFoundException => "Resource Not Found",
                ArgumentException or InvalidOperationException => "Invalid Request",
                UnauthorizedAccessException => "Unauthorized",
                _ => "An unexpected server error occurred."
            },
            Detail = exception is KeyNotFoundException or ArgumentException or InvalidOperationException
                ? exception.Message
                : "Please contact support if the issue persists."
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(problem));
    }
}
