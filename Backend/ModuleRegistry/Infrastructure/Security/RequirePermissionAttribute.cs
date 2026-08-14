using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ModuleRegistry.Infrastructure.Security;

/// <summary>Server-side enforcement for the admin RemoteApps CRUD surface — see AuthService's identical attribute for the full rationale. Must be combined with [Authorize].</summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class RequirePermissionAttribute(string featureKey, string capability) : Attribute, IAsyncActionFilter
{
    public Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var user = context.HttpContext.User;

        var isAdministrator = user.FindFirst(JwtClaimTypes.Administrator)?.Value == "true";
        if (isAdministrator)
        {
            return next();
        }

        var permsClaim = user.FindFirst(JwtClaimTypes.Permissions)?.Value;
        var permissions = string.IsNullOrEmpty(permsClaim) ? [] : JsonSerializer.Deserialize<string[]>(permsClaim) ?? [];

        var required = $"{featureKey}:{capability}";
        if (!permissions.Contains(required))
        {
            context.Result = new ObjectResult(new ProblemDetails
            {
                Title = $"You don't have '{capability}' access to '{featureKey}'.",
                Status = StatusCodes.Status403Forbidden,
            })
            { StatusCode = StatusCodes.Status403Forbidden };
            return Task.CompletedTask;
        }

        return next();
    }
}
