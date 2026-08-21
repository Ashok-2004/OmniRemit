using backend.Infrastructure;

namespace backend.Middleware;

/// <summary>
/// Registered before CORS/authentication (see Program.cs) so an exception anywhere downstream —
/// including inside the auth handler — still comes back as a real JSON error with CORS headers
/// intact, rather than a bare 500 the browser reports as an opaque CORS failure. Mirrors
/// EmployeeService's ExceptionMiddleware, the reference implementation for this pattern.
/// </summary>
public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;

    public ExceptionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (ApprovalServiceUnavailableException ex)
        {
            // A gating check that couldn't be verified must block the mutation, not silently apply
            // it — never collapse this into the generic 500 branch below.
            context.Response.StatusCode = 503;

            await context.Response.WriteAsJsonAsync(new
            {
                success = false,
                message = ex.Message
            });
        }
        catch (Exception ex)
        {
            context.Response.StatusCode = 500;

            await context.Response.WriteAsJsonAsync(new
            {
                success = false,
                message = ex.Message
            });
        }
    }
}
