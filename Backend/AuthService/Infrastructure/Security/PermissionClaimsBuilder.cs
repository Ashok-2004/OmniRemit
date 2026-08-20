using AuthService.Domain.Entities;
using AuthService.Domain.Enums;
using Microsoft.EntityFrameworkCore;
// Capability is now a plain string per feature (see PermissionFeatureCapability) — no fixed enum.

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
        /*
         * A "No Role" user is NOT the same as "no permissions, full stop" — the Extra Permissions step
         * on the user form explicitly supports granting individual overrides to any user regardless of
         * role, "no role" included (that's precisely how a Maker-Checker approval works: a checker who
         * needs only the Approvals capability and nothing else, with no role to attach it to). This
         * used to early-return `[]` the moment RoleId was null, before UserPermissionOverrides was ever
         * queried — so a roleless user's overrides were computed correctly by ReplacePermissionOverridesAsync,
         * stored correctly, visible correctly in the edit form... and then silently discarded every
         * single time an access token was actually minted. The bug was invisible because almost every
         * account in practice has a role; it surfaced testing a role-less checker granted the Approvals
         * capability directly, whose freshly-minted token still carried zero permissions.
         *
         * Fix: treat "no role" as "zero role grants", not as "skip permissions entirely" — the override
         * loop below still runs and Grant overrides still take effect on top of that empty base.
         */
        Role? role = null;
        if (user.RoleId is not null)
        {
            role = await db.Roles.AsNoTracking().FirstOrDefaultAsync(r => r.Id == user.RoleId, ct);
        }

        if (role is { IsAdministrator: true })
        {
            // Unrestricted — no need to materialize the full grant list, the frontend/backend both
            // treat IsAdministrator as "every capability on every feature, forever".
            return new PermissionClaimsResult(true, []);
        }

        var roleGrantPairs = new List<(string Key, string Capability)>();
        if (role is not null)
        {
            var roleGrants = await db.RolePermissions
                .AsNoTracking()
                .Where(rp => rp.RoleId == role.Id && rp.Feature!.IsActive)
                .Select(rp => new { rp.Feature!.Key, rp.Capability })
                .ToListAsync(ct);
            roleGrantPairs.AddRange(roleGrants.Select(g => (g.Key, g.Capability)));
        }

        var overrides = await db.UserPermissionOverrides
            .AsNoTracking()
            .Where(o => o.UserId == user.Id && o.Feature!.IsActive)
            .Select(o => new { o.Feature!.Key, o.Capability, o.Effect })
            .ToListAsync(ct);

        var effective = new HashSet<(string Key, string Capability)>(roleGrantPairs);

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
