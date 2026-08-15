using System.Reflection;
using EmployeeService.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EmployeeService.Controllers;

/// <summary>
/// This service's capability self-declaration — what ModuleRegistry's RemoteApp.PermissionsSourceUrl
/// points at once this app is registered (key "employee"). Anonymous on purpose: it only discloses
/// the shape of available actions (e.g. "Create", "Edit"), never any employee data, and ModuleRegistry's
/// fetch runs without a user's own JWT (it's a server-to-server discovery poll, not an end-user
/// request). See RequiresCapabilityAttribute for how a new capability gets picked up automatically.
/// </summary>
[ApiController]
[Route("permissions")]
[AllowAnonymous]
public class PermissionsController : ControllerBase
{
    [HttpGet]
    public ActionResult<object> Get()
    {
        return Ok(new { capabilities = DiscoverCapabilities() });
    }

    private static IReadOnlyList<object> DiscoverCapabilities()
    {
        var capabilityKeys = new SortedSet<string>(StringComparer.Ordinal);

        foreach (var type in typeof(PermissionsController).Assembly.GetTypes())
        {
            if (!typeof(ControllerBase).IsAssignableFrom(type)) continue;

            foreach (var attr in type.GetCustomAttributes<RequiresCapabilityAttribute>(true))
            {
                capabilityKeys.Add(attr.Capability);
            }

            foreach (var method in type.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            {
                foreach (var attr in method.GetCustomAttributes<RequiresCapabilityAttribute>(true))
                {
                    capabilityKeys.Add(attr.Capability);
                }
            }
        }

        return capabilityKeys.Select(key => (object)new { key, displayName = key }).ToList();
    }
}
