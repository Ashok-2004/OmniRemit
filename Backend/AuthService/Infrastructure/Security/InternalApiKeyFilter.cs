using AuthService.Options;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;

namespace AuthService.Infrastructure.Security;

/// <summary>
/// Guards the /internal endpoints ModuleRegistry calls to sync the permission catalog. Not JWT
/// auth — a static shared secret compared against the X-Internal-Api-Key header. A v1
/// simplification (see the plan's risk notes); revisit before a hardened multi-tenant deployment.
/// </summary>
public class InternalApiKeyFilter(IOptions<InternalApiOptions> options) : IAsyncActionFilter
{
    private const string HeaderName = "X-Internal-Api-Key";

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var expected = options.Value.ApiKey;
        if (string.IsNullOrWhiteSpace(expected))
        {
            context.Result = new ObjectResult(new ProblemDetails
            {
                Title = "Internal API key is not configured on this service.",
                Status = StatusCodes.Status503ServiceUnavailable,
            })
            { StatusCode = StatusCodes.Status503ServiceUnavailable };
            return;
        }

        var provided = context.HttpContext.Request.Headers[HeaderName].ToString();
        if (!string.Equals(provided, expected, StringComparison.Ordinal))
        {
            context.Result = new UnauthorizedObjectResult(new ProblemDetails
            {
                Title = "Missing or invalid internal API key.",
                Status = StatusCodes.Status401Unauthorized,
            });
            return;
        }

        await next();
    }
}
