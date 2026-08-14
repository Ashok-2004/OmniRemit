using AuthService.Domain.Entities;
using AuthService.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Infrastructure.Security;

/// <summary>
/// Computes a user's effective permissions server-side: role grants unioned with the user's
/// Grant overrides, minus Revoke overrides, restricted to currently-active permission features
/// (a soft-disabled feature — e.g. a removed remote app — never appears even if old rows reference it).
/// This is the single place that logic lives; both login and refresh call it fresh every time.
/// </summary>
public class PermissionClaimsBuilder(AuthDbContext db)
{
    public async Task<PermissionClaimsResult> BuildAsync(User user, CancellationToken ct = default)
    {
        if (user.RoleId is null)
        {
            return new PermissionClaimsResult(false, []);
        }

        var role = await db.Roles.AsNoTracking().FirstOrDefaultAsync(r => r.Id == user.RoleId, ct);
        if (role is null)
        {
            return new PermissionClaimsResult(false, []);
        }

        if (role.IsAdministrator)
        {
            // Unrestricted — no need to materialize the full grant list, the frontend/backend both
            // treat IsAdministrator as "every capability on every feature, forever".
            return new PermissionClaimsResult(true, []);
        }

        var roleGrants = await db.RolePermissions
            .AsNoTracking()
            .Where(rp => rp.RoleId == role.Id && rp.Feature!.IsActive)
            .Select(rp => new { rp.Feature!.Key, rp.Capability })
            .ToListAsync(ct);

        var overrides = await db.UserPermissionOverrides
            .AsNoTracking()
            .Where(o => o.UserId == user.Id && o.Feature!.IsActive)
            .Select(o => new { o.Feature!.Key, o.Capability, o.Effect })
            .ToListAsync(ct);

        var effective = new HashSet<(string Key, CapabilityType Capability)>(
            roleGrants.Select(g => (g.Key, g.Capability)));

        foreach (var o in overrides)
        {
            var entry = (o.Key, o.Capability);
            if (o.Effect == PermissionEffect.Grant)
            {
                effective.Add(entry);
            }
            else
            {
                effective.Remove(entry);
            }
        }

        var permissions = effective
            .Select(e => $"{e.Key}:{e.Capability}")
            .OrderBy(s => s, StringComparer.Ordinal)
            .ToList();

        return new PermissionClaimsResult(false, permissions);
    }
}
