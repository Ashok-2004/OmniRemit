using AuthService.Domain.Entities;
using AuthService.Domain.Enums;
using AuthService.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Infrastructure.Seed;

/// <summary>
/// Bootstraps a brand-new AuthDb with the host's own permission catalog (the four features the
/// host application itself owns — everything else in the catalog arrives later, pushed in by the
/// Module Registry service as remote apps get registered) and a starter set of built-in roles +
/// one Super Admin account so there is a way to log in on day one.
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
        public const string SettingsMaintenance = "host.settings.maintenance";
    }

    public static async Task SeedAsync(AuthDbContext db, ILogger logger, CancellationToken ct = default)
    {
        var features = await SeedHostFeaturesAsync(db, ct);
        var roles = await SeedRolesAsync(db, features, ct);
        await SeedSuperAdminUserAsync(db, roles, logger, ct);
    }

    private static async Task<Dictionary<string, PermissionFeature>> SeedHostFeaturesAsync(AuthDbContext db, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var seedFeatures = new[]
        {
            new { Key = HostFeatureKeys.Dashboard, DisplayName = "Dashboard", SortOrder = 0 },
            new { Key = HostFeatureKeys.SettingsUsers, DisplayName = "Setup — User", SortOrder = 10 },
            new { Key = HostFeatureKeys.SettingsRoles, DisplayName = "Setup — Role", SortOrder = 20 },
            new { Key = HostFeatureKeys.SettingsMaintenance, DisplayName = "Setup — Maintenance", SortOrder = 30 },
        };

        var existingKeys = await db.PermissionFeatures.Select(f => f.Key).ToListAsync(ct);

        foreach (var seed in seedFeatures)
        {
            if (existingKeys.Contains(seed.Key))
            {
                continue;
            }

            db.PermissionFeatures.Add(new PermissionFeature
            {
                Id = Guid.NewGuid(),
                Key = seed.Key,
                DisplayName = seed.DisplayName,
                Source = PermissionFeatureSource.Host,
                IsActive = true,
                SortOrder = seed.SortOrder,
                CreatedAt = now,
                UpdatedAt = now,
            });
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
        var seedRoles = new (string Name, string Description, bool IsAdministrator, Dictionary<string, CapabilityType[]> Grants)[]
        {
            ("Super Admin", "Unrestricted access to every feature and function.", true, []),
            ("Admin", "Full access except deleting users or roles.", false, new()
            {
                [HostFeatureKeys.Dashboard] = [CapabilityType.View],
                [HostFeatureKeys.SettingsUsers] = [CapabilityType.View, CapabilityType.Create, CapabilityType.Edit],
                [HostFeatureKeys.SettingsRoles] = [CapabilityType.View, CapabilityType.Create, CapabilityType.Edit],
                [HostFeatureKeys.SettingsMaintenance] = [CapabilityType.View, CapabilityType.Create, CapabilityType.Edit],
            }),
            ("Manager", "Runs campaigns, contacts and boards day to day.", false, new()
            {
                [HostFeatureKeys.Dashboard] = [CapabilityType.View],
            }),
            ("Agent", "Handles conversations and contacts assigned to them.", false, new()
            {
                [HostFeatureKeys.Dashboard] = [CapabilityType.View],
            }),
            ("Normal User", "Basic access to chat, contacts and their own work.", false, new()
            {
                [HostFeatureKeys.Dashboard] = [CapabilityType.View],
            }),
            ("Read Only User", "Can view everything but change nothing.", false, new()
            {
                [HostFeatureKeys.Dashboard] = [CapabilityType.View],
                [HostFeatureKeys.SettingsUsers] = [CapabilityType.View],
                [HostFeatureKeys.SettingsRoles] = [CapabilityType.View],
                [HostFeatureKeys.SettingsMaintenance] = [CapabilityType.View],
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
