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
/// <remarks>
/// Implemented as an <see cref="IAsyncAuthorizationFilter"/>, NOT an action filter.
///
/// It was previously an action filter, which put it after model binding in the pipeline. Because
/// [ApiController] registers its automatic ModelState-invalid 400 as an action filter at
/// Order = -2000, an unauthorized POST with a malformed body returned 400 *before* the capability
/// check ran at all. Verified live: a token holding only remote.employee.employee:View got 403 on
/// PUT and DELETE but 400 on POST.
///
/// No unauthorized write actually completed — a valid payload still reached the check and was denied
/// — but the behaviour was wrong in two ways that matter for a bank:
///   * It let an unauthorized caller probe the validation rules, distinguishing a well-formed payload
///     (403) from a malformed one (400), which discloses the shape of an API they may not use.
///   * Authorization ran after model binding, so any action filter registered with a lower Order
///     would execute for a request that was about to be refused.
/// Authorization must never depend on whether the body happens to be valid. In the authorization
/// stage the answer is 403 either way.
/// </remarks>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true)]
public class RequiresCapabilityAttribute : Attribute, IAsyncAuthorizationFilter
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

    public Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;

        // Defence in depth. [Authorize] on the controller should already have rejected an
        // unauthenticated caller, but an empty perms claim on an unauthenticated principal would
        // otherwise be indistinguishable from a real user holding no permissions.
        if (user.Identity?.IsAuthenticated != true)
        {
            context.Result = new UnauthorizedResult();
            return Task.CompletedTask;
        }

        var isAdministrator = user.FindFirst(JwtClaimTypes.Administrator)?.Value == "true";
        if (isAdministrator)
        {
            return Task.CompletedTask;
        }

        string[] permissions;
        try
        {
            var permsClaim = user.FindFirst(JwtClaimTypes.Permissions)?.Value;
            permissions = string.IsNullOrEmpty(permsClaim)
                ? []
                : JsonSerializer.Deserialize<string[]>(permsClaim) ?? [];
        }
        catch (JsonException)
        {
            // A malformed perms claim must fail CLOSED. Letting the exception escape would surface as
            // a 500, and treating it as "no permissions" is the only safe reading of a claim we can't
            // parse — never "all permissions".
            permissions = [];
        }

        if (!permissions.Contains(RequiredPermission))
        {
            context.Result = new ObjectResult(new ProblemDetails
            {
                Title = $"You don't have '{Capability}' access to {Module}.",
                Status = StatusCodes.Status403Forbidden,
            })
            { StatusCode = StatusCodes.Status403Forbidden };
        }

        return Task.CompletedTask;
    }
}
