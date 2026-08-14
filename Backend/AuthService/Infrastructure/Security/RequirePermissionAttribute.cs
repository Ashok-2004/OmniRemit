using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace AuthService.Infrastructure.Security;

/// <summary>
/// Server-side enforcement mirroring the frontend's usePermission() gate — the frontend hides
/// buttons the user can't use, this is what actually stops the request if someone calls the API
/// directly. Reads the "administrator"/"perms" claims embedded in the access token at login/refresh
/// (see JwtTokenService), so it never touches the database. Must be combined with [Authorize].
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class RequirePermissionAttribute(string featureKey, string capability) : Attribute, IAsyncActionFilter
{
    public Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var user = context.HttpContext.User;

        var isAdministrator = user.FindFirst(JwtTokenService.AdministratorClaimType)?.Value == "true";
        if (isAdministrator)
        {
            return next();
        }

        var permsClaim = user.FindFirst(JwtTokenService.PermissionsClaimType)?.Value;
        var permissions = string.IsNullOrEmpty(permsClaim)
            ? []
            : JsonSerializer.Deserialize<string[]>(permsClaim) ?? [];

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
