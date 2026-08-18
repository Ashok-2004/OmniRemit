using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace LeadManagement.Api.Infrastructure.Security;

/// <summary>
/// Server-side capability enforcement and dynamic permission discovery source for LeadService.
/// Reads the cached `perms` claim in the RS256 JWT without network round-trips.
/// Follows the exact standard established by EmployeeService and AuthService.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true)]
public class RequiresCapabilityAttribute : Attribute, IAsyncAuthorizationFilter
{
    /// <summary>
    /// Root PermissionFeatureKey when registered in ModuleRegistry with Key = "lead".
    /// </summary>
    public const string FeatureKey = "remote.lead";

    public string Module { get; }
    public string Capability { get; }

    public RequiresCapabilityAttribute(string module, string capability)
    {
        Module = module;
        Capability = capability;
    }

    /// <summary>
    /// The permission string this attribute enforces: e.g. "remote.lead.lead:View", "remote.lead.dashboard:View".
    /// </summary>
    public string RequiredPermission => $"{FeatureKey}.{Module.ToLowerInvariant()}:{Capability}";

    public Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;

        if (user.Identity?.IsAuthenticated != true)
        {
            context.Result = new UnauthorizedResult();
            return Task.CompletedTask;
        }

        // Administrator bypass — identical to EmployeeService and AuthService
        var isAdministrator =
            user.FindFirst(JwtClaimTypes.Administrator)?.Value == "true" ||
            user.FindFirst("administrator")?.Value == "true" ||
            user.FindFirst("admin")?.Value == "true" ||
            user.FindFirst("isAdministrator")?.Value?.Equals("true", StringComparison.OrdinalIgnoreCase) == true ||
            user.Claims.Any(c => (c.Type == "administrator" || c.Type == "admin" || c.Type == "isAdministrator") &&
                                 c.Value.Equals("true", StringComparison.OrdinalIgnoreCase)) ||
            user.IsInRole("Admin") ||
            user.IsInRole("SuperAdmin") ||
            user.IsInRole("Administrator");

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
            permissions = [];
        }

        var hasMatch = permissions.Any(p =>
            string.Equals(p, RequiredPermission, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(p, $"{FeatureKey}:{Module.ToLowerInvariant()}.{Capability}", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(p, $"{FeatureKey}:{Capability}", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(p, $"{FeatureKey}.{Module.ToLowerInvariant()}:{Capability.ToLowerInvariant()}", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(p, $"{Module.ToLowerInvariant()}:{Capability}", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(p, $"{FeatureKey}:*", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(p, "*", StringComparison.OrdinalIgnoreCase) ||
            p.StartsWith($"{FeatureKey}.", StringComparison.OrdinalIgnoreCase) ||
            p.StartsWith($"{FeatureKey}:", StringComparison.OrdinalIgnoreCase));

        if (!hasMatch)
        {
            context.Result = new ObjectResult(new ProblemDetails
            {
                Title = $"You don't have '{Capability}' access to {Module}.",
                Status = StatusCodes.Status403Forbidden,
                Detail = $"Required permission: {RequiredPermission}"
            })
            { StatusCode = StatusCodes.Status403Forbidden };
        }

        return Task.CompletedTask;
    }
}
