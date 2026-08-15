using AuthService.Domain.Entities;
using AuthService.Domain.Enums;
using AuthService.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Infrastructure.Seed;

/// <summary>
/// Bootstraps a brand-new AuthDb with the host's own permission catalog (the features the host
/// application itself owns, each with its own small fixed capability set — everything else in the
/// catalog arrives later, pushed in by the Module Registry service as remote apps get registered,
/// each declaring its own dynamic capability set) and a starter set of built-in roles + one Super
/// Admin account so there is a way to log in on day one.
///
/// Idempotent: safe to run on every startup, only inserts what's missing.
/// </summary>
public static class AuthDbSeeder
{
    // Host-owned permission features. Keys are stable identifiers referenced by RolePermission /
    // UserPermissionOverride rows and by the frontend's route/section permission gates.
    public static class HostFeatureKeys
    {
        public const string Dashboard = "host.dashboard";
        public const string SettingsUsers = "host.settings.users";
        public const string SettingsRoles = "host.settings.roles";
        public const string SettingsApplications = "host.settings.applications";
        public const string SystemAuditLogs = "host.system.audit-logs";
    }

    private static readonly string[] StandardCrud = ["View", "Create", "Edit", "Delete"];
    private static readonly string[] ViewOnly = ["View"];

    public static async Task SeedAsync(AuthDbContext db, ILogger logger, CancellationToken ct = default)
    {
        // "Maintenance" was renamed to "Applications" as the platform matured — rename the existing
        // row in place (RolePermission references FeatureId, not the key string, so every existing
        // grant survives untouched) rather than seeding a duplicate and orphaning the old one.
        await RenameLegacyFeatureKeyAsync(db, "host.settings.maintenance", HostFeatureKeys.SettingsApplications, "Setup — Applications", ct);

        var features = await SeedHostFeaturesAsync(db, ct);
        var roles = await SeedRolesAsync(db, features, ct);
        await SeedSuperAdminUserAsync(db, roles, logger, ct);
    }

    private static async Task RenameLegacyFeatureKeyAsync(AuthDbContext db, string oldKey, string newKey, string newDisplayName, CancellationToken ct)
    {
        var existing = await db.PermissionFeatures.FirstOrDefaultAsync(f => f.Key == oldKey, ct);
        if (existing is null)
        {
            return;
        }

        existing.Key = newKey;
        existing.DisplayName = newDisplayName;
        existing.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private static async Task<Dictionary<string, PermissionFeature>> SeedHostFeaturesAsync(AuthDbContext db, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var seedFeatures = new[]
        {
            new { Key = HostFeatureKeys.Dashboard, DisplayName = "Dashboard", SortOrder = 0, Capabilities = ViewOnly },
            new { Key = HostFeatureKeys.SettingsUsers, DisplayName = "Setup — User", SortOrder = 10, Capabilities = StandardCrud },
            new { Key = HostFeatureKeys.SettingsRoles, DisplayName = "Setup — Role", SortOrder = 20, Capabilities = StandardCrud },
            new { Key = HostFeatureKeys.SettingsApplications, DisplayName = "Setup — Applications", SortOrder = 30, Capabilities = StandardCrud },
            new { Key = HostFeatureKeys.SystemAuditLogs, DisplayName = "System — Audit Logs", SortOrder = 40, Capabilities = ViewOnly },
        };

        var existing = await db.PermissionFeatures.Include(f => f.Capabilities).ToDictionaryAsync(f => f.Key, ct);

        foreach (var seed in seedFeatures)
        {
            if (existing.TryGetValue(seed.Key, out var feature))
            {
                // Feature row already exists (from an earlier startup) — make sure its capability
                // set is caught up too, in case a new host capability was added since.
                var existingCapKeys = feature.Capabilities.Select(c => c.Key).ToHashSet();
                foreach (var capKey in seed.Capabilities.Where(c => !existingCapKeys.Contains(c)))
                {
                    db.PermissionFeatureCapabilities.Add(new PermissionFeatureCapability
                    {
                        Id = Guid.NewGuid(),
                        FeatureId = feature.Id,
                        Key = capKey,
                        DisplayName = capKey,
                        SortOrder = Array.IndexOf(seed.Capabilities, capKey),
                    });
                }
                continue;
            }

            feature = new PermissionFeature
            {
                Id = Guid.NewGuid(),
                Key = seed.Key,
                DisplayName = seed.DisplayName,
                Source = PermissionFeatureSource.Host,
                IsActive = true,
                SortOrder = seed.SortOrder,
                CreatedAt = now,
                UpdatedAt = now,
            };
            db.PermissionFeatures.Add(feature);

            for (var i = 0; i < seed.Capabilities.Length; i++)
            {
                db.PermissionFeatureCapabilities.Add(new PermissionFeatureCapability
                {
                    Id = Guid.NewGuid(),
                    FeatureId = feature.Id,
                    Key = seed.Capabilities[i],
                    DisplayName = seed.Capabilities[i],
                    SortOrder = i,
                });
            }
        }

        if (db.ChangeTracker.HasChanges())
        {
            await db.SaveChangesAsync(ct);
        }

        return await db.PermissionFeatures.ToDictionaryAsync(f => f.Key, ct);
    }

    private static async Task<Dictionary<string, Role>> SeedRolesAsync(
        AuthDbContext db,
        Dictionary<string, PermissionFeature> features,
        CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;

        // (name, description, isAdministrator, grants) — grants maps a feature key to the
        // capabilities that feature exposes for this role. All are built-in/system roles so they
        // can't be deleted, but admins can still edit their permissions freely.
        var seedRoles = new (string Name, string Description, bool IsAdministrator, Dictionary<string, string[]> Grants)[]
        {
            ("Super Admin", "Unrestricted access to every feature and function.", true, []),
            ("Admin", "Full access except deleting users or roles.", false, new()
            {
                [HostFeatureKeys.Dashboard] = ["View"],
                [HostFeatureKeys.SettingsUsers] = ["View", "Create", "Edit"],
                [HostFeatureKeys.SettingsRoles] = ["View", "Create", "Edit"],
                [HostFeatureKeys.SettingsApplications] = ["View", "Create", "Edit"],
                [HostFeatureKeys.SystemAuditLogs] = ["View"],
            }),
            ("Manager", "Runs campaigns, contacts and boards day to day.", false, new()
            {
                [HostFeatureKeys.Dashboard] = ["View"],
            }),
            ("Agent", "Handles conversations and contacts assigned to them.", false, new()
            {
                [HostFeatureKeys.Dashboard] = ["View"],
            }),
            ("Normal User", "Basic access to chat, contacts and their own work.", false, new()
            {
                [HostFeatureKeys.Dashboard] = ["View"],
            }),
            ("Read Only User", "Can view everything but change nothing.", false, new()
            {
                [HostFeatureKeys.Dashboard] = ["View"],
                [HostFeatureKeys.SettingsUsers] = ["View"],
                [HostFeatureKeys.SettingsRoles] = ["View"],
                [HostFeatureKeys.SettingsApplications] = ["View"],
                [HostFeatureKeys.SystemAuditLogs] = ["View"],
            }),
        };

        var existingNames = await db.Roles.Select(r => r.Name).ToListAsync(ct);

        foreach (var seed in seedRoles)
        {
            if (existingNames.Contains(seed.Name))
            {
                continue;
            }

            var role = new Role
            {
                Id = Guid.NewGuid(),
                Name = seed.Name,
                Description = seed.Description,
                IsSystemRole = true,
                IsAdministrator = seed.IsAdministrator,
                CreatedAt = now,
                UpdatedAt = now,
            };
            db.Roles.Add(role);

            foreach (var (featureKey, capabilities) in seed.Grants)
            {
                if (!features.TryGetValue(featureKey, out var feature))
                {
                    continue;
                }

                foreach (var capability in capabilities)
                {
                    db.RolePermissions.Add(new RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = role.Id,
                        FeatureId = feature.Id,
                        Capability = capability,
                    });
                }
            }
        }

        if (db.ChangeTracker.HasChanges())
        {
            await db.SaveChangesAsync(ct);
        }

        return await db.Roles.ToDictionaryAsync(r => r.Name, ct);
    }

    private static async Task SeedSuperAdminUserAsync(
        AuthDbContext db,
        Dictionary<string, Role> roles,
        ILogger logger,
        CancellationToken ct)
    {
        const string bootstrapEmail = "superadmin@omniremit.local";

        if (await db.Users.AnyAsync(ct))
        {
            return;
        }

        if (!roles.TryGetValue("Super Admin", out var superAdminRole))
        {
            logger.LogError("Cannot seed bootstrap user: Super Admin role was not seeded.");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var tempPassword = TemporaryPasswordGenerator.Generate();
        var hasher = new PasswordHasher();

        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = "Super Admin",
            Email = bootstrapEmail,
            PasswordHash = string.Empty,
            Status = UserStatus.Active,
            RoleId = superAdminRole.Id,
            MustChangePassword = true,
            CreatedAt = now,
            UpdatedAt = now,
        };
        user.PasswordHash = hasher.Hash(user, tempPassword);

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        logger.LogWarning(
            "Seeded bootstrap Super Admin account. Email: {Email} | Temporary password: {TempPassword} " +
            "— sign in and change it immediately; this is logged only once, on first startup against an empty database.",
            bootstrapEmail,
            tempPassword);
    }
}
