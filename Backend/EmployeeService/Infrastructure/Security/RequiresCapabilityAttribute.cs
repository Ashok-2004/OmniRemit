using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace EmployeeService.Infrastructure.Security;

/// <summary>
/// Server-side enforcement AND the source of truth for this service's permission discovery
/// endpoint (see Controllers/PermissionsController). Decorate an action with
/// [RequiresCapability("Delete")] and two things happen automatically: the action is protected
/// locally (reads the `perms` claim already embedded in the JWT at login — zero network calls, so
/// AuthService being briefly unreachable never blocks or slows down an Employee request), and the
/// capability appears in GET /api/employee-service/permissions, which is what ModuleRegistry's
/// PermissionsSourceUrl fetch scrapes to keep the host's Role editor in sync. Nothing about adding
/// a new capability needs to be hand-registered anywhere else.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class RequiresCapabilityAttribute(string capability) : Attribute, IAsyncActionFilter
{
    /// <summary>
    /// This service's own PermissionFeatureKey once registered in ModuleRegistry — derived the same
    /// way ModuleRegistry derives every remote's key ($"remote.{key}"), for RemoteApp.Key = "employee".
    /// </summary>
    public const string FeatureKey = "remote.employee";

    public string Capability { get; } = capability;

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

        var required = $"{FeatureKey}:{Capability}";
        if (!permissions.Contains(required))
        {
            context.Result = new ObjectResult(new ProblemDetails
            {
                Title = $"You don't have '{Capability}' access to Employee.",
                Status = StatusCodes.Status403Forbidden,
            })
            { StatusCode = StatusCodes.Status403Forbidden };
            return Task.CompletedTask;
        }

        return next();
    }
}
