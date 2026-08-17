using System.Reflection;
using EmployeeService.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EmployeeService.Controllers;

/// <summary>
/// Declares what this service can grant, so the host's Role editor renders it without anything being
/// hand-typed there. Anonymous on purpose: ModuleRegistry fetches it during app registration, before
/// any permission for this app exists to authorise the call with.
/// </summary>
[ApiController]
[Route("permissions")]
[AllowAnonymous]
public class PermissionsController : ControllerBase
{
    [HttpGet]
    public ActionResult<object> Get() => Ok(new
    {
        // Discovery contract v2 — a MODULE level above capabilities, so the Role editor can render
        // "Employee Management > Department > Edit" instead of one flat list of verbs.
        //
        // `capabilities` is still emitted alongside it, flattened, purely so an older ModuleRegistry
        // that does not yet understand `modules` keeps working against this service instead of
        // reading zero permissions and silently revoking everyone's access.
        modules = DiscoverModules(),
        capabilities = DiscoverModules()
            .SelectMany(m => m.Capabilities.Select(c => new { key = $"{m.Key}.{c.Key}", displayName = $"{m.DisplayName} — {c.DisplayName}" }))
            .ToList(),
    });

    private record DiscoveredCapability(string Key, string DisplayName);

    private record DiscoveredModule(string Key, string DisplayName, IReadOnlyList<DiscoveredCapability> Capabilities);

    /// <summary>
    /// Reflects over every [RequiresCapability] in this assembly and groups them by module. Adding a
    /// new sub-module or action anywhere in this service makes it appear here — and therefore in the
    /// host's Role editor — with no further registration step.
    /// </summary>
    private static List<DiscoveredModule> DiscoverModules()
    {
        // module key -> (display name, capability keys). Sorted so the endpoint's output is stable
        // between calls; an unstable order would make every registry resync look like a real change.
        var modules = new SortedDictionary<string, (string DisplayName, SortedSet<string> Capabilities)>(StringComparer.Ordinal);

        foreach (var type in typeof(PermissionsController).Assembly.GetTypes())
        {
            if (!typeof(ControllerBase).IsAssignableFrom(type))
            {
                continue;
            }

            var attributes = type.GetCustomAttributes<RequiresCapabilityAttribute>(true)
                .Concat(type
                    .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                    .SelectMany(m => m.GetCustomAttributes<RequiresCapabilityAttribute>(true)));

            foreach (var attribute in attributes)
            {
                var moduleKey = attribute.Module.ToLowerInvariant();
                if (!modules.TryGetValue(moduleKey, out var entry))
                {
                    entry = (attribute.Module, new SortedSet<string>(StringComparer.Ordinal));
                    modules[moduleKey] = entry;
                }

                entry.Capabilities.Add(attribute.Capability);
            }
        }

        return modules
            .Select(kv => new DiscoveredModule(
                kv.Key,
                kv.Value.DisplayName,
                kv.Value.Capabilities.Select(c => new DiscoveredCapability(c, c)).ToList()))
            .ToList();
    }
}
