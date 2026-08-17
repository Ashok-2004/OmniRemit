using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace EmployeeService.Infrastructure.Security;

/// <summary>
/// Server-side enforcement AND the source of truth for this service's permission discovery
/// endpoint (see Controllers/PermissionsController). Decorate an action with
/// [RequiresCapability("Department", "Edit")] and two things happen automatically: the action is
/// protected locally (reads the `perms` claim already embedded in the JWT at login — zero network
/// calls, so AuthService being briefly unreachable never blocks or slows down an Employee request),
/// and the module + capability appear in GET /api/employee-service/permissions, which is what
/// ModuleRegistry's PermissionsSourceUrl fetch scrapes to keep the host's Role editor in sync.
/// Nothing about adding a new module or capability needs to be hand-registered anywhere else.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true)]
public class RequiresCapabilityAttribute : Attribute, IAsyncActionFilter
{
    /// <summary>
    /// This service's own root PermissionFeatureKey once registered in ModuleRegistry — derived the
    /// same way ModuleRegistry derives every remote's key ($"remote.{key}"), for
    /// RemoteApp.Key = "employee".
    /// </summary>
    public const string FeatureKey = "remote.employee";

    /// <summary>
    /// Sub-module this action belongs to, e.g. "Department". Combined with <see cref="FeatureKey"/>
    /// it forms the child feature key the host stores and the JWT carries:
    /// <c>remote.employee.department:Edit</c>.
    /// </summary>
    public string Module { get; }

    public string Capability { get; }

    /// <param name="module">Sub-module name as it should appear in the Role editor, e.g. "Department".</param>
    /// <param name="capability">Action within that sub-module, e.g. "Edit".</param>
    public RequiresCapabilityAttribute(string module, string capability)
    {
        Module = module;
        Capability = capability;
    }

    /// <summary>
    /// The permission string this attribute enforces. Module names are lower-cased into the key so
    /// the wire format stays stable regardless of how the display name is capitalised.
    /// </summary>
    public string RequiredPermission => $"{FeatureKey}.{Module.ToLowerInvariant()}:{Capability}";

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

        if (!permissions.Contains(RequiredPermission))
        {
            context.Result = new ObjectResult(new ProblemDetails
            {
                Title = $"You don't have '{Capability}' access to {Module}.",
                Status = StatusCodes.Status403Forbidden,
            })
            { StatusCode = StatusCodes.Status403Forbidden };
            return Task.CompletedTask;
        }

        return next();
    }
}
