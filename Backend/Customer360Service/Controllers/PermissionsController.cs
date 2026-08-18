using System.Reflection;
using backend.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

/// <summary>
/// Dynamic permissions discovery endpoint for Customer360Service.
/// ModuleRegistry fetches this during app registration / resync to populate
/// AuthService's PermissionFeatures catalog for role assignments.
/// </summary>
[ApiController]
[Route("permissions")]
[AllowAnonymous]
public class PermissionsController : ControllerBase
{
    [HttpGet]
    public ActionResult<object> Get()
    {
        var modules = DiscoverModules();
        return Ok(new
        {
            modules,
            capabilities = modules
                .SelectMany(m => m.Capabilities.Select(c => new { key = $"{m.Key}.{c.Key}", displayName = $"{m.DisplayName} — {c.DisplayName}" }))
                .ToList(),
        });
    }

    private record DiscoveredCapability(string Key, string DisplayName);

    private record DiscoveredModule(string Key, string DisplayName, IReadOnlyList<DiscoveredCapability> Capabilities);

    /// <summary>
    /// Reflects over every [RequiresCapability] in this assembly and groups them by module.
    /// </summary>
    private static List<DiscoveredModule> DiscoverModules()
    {
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
