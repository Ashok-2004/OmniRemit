using AuthService.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Infrastructure;

public class AuthDbContext(DbContextOptions<AuthDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<PermissionFeature> PermissionFeatures => Set<PermissionFeature>();
    public DbSet<PermissionFeatureCapability> PermissionFeatureCapabilities => Set<PermissionFeatureCapability>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<UserPermissionOverride> UserPermissionOverrides => Set<UserPermissionOverride>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasIndex(r => r.Name).IsUnique();
            entity.Property(r => r.Name).HasMaxLength(100);
            entity.Property(r => r.Description).HasMaxLength(500);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.Name).HasMaxLength(200);
            entity.Property(u => u.Email).HasMaxLength(320);
            entity.Property(u => u.PhoneNumber).HasMaxLength(32);
            entity.Property(u => u.Status).HasConversion<string>().HasMaxLength(20);
            entity.Property(u => u.AuthProvider).HasConversion<string>().HasMaxLength(20);

            entity.HasOne(u => u.Role)
                .WithMany(r => r.Users)
                .HasForeignKey(u => u.RoleId)
                .OnDelete(DeleteBehavior.Restrict); // role deletion is blocked at the app layer while users reference it; this is defense in depth

            entity.HasQueryFilter(u => !u.IsDeleted);

            // Every page of GET /api/users sorts by Name, and GET /api/roles/{id}/users does too —
            // previously an unindexed sort of the whole filtered set on every request.
            entity.HasIndex(u => u.Name);

            // Status is an equality filter on the same list endpoint.
            entity.HasIndex(u => u.Status);

            // IsDeleted is appended to EVERY Users query by the global filter above, so it is the
            // single most-touched predicate in this service.
            entity.HasIndex(u => u.IsDeleted);
        });

        modelBuilder.Entity<PermissionFeature>(entity =>
        {
            entity.HasIndex(f => f.Key).IsUnique();
            entity.Property(f => f.Key).HasMaxLength(200);
            entity.Property(f => f.DisplayName).HasMaxLength(200);

            // Self-referencing hierarchy: a sub-module is a feature whose parent is its module.
            // Restrict, not Cascade — a module must not silently take its sub-modules' grant history
            // with it; deactivation (IsActive = false) is the intended removal path.
            entity.HasOne(f => f.ParentFeature)
                .WithMany(f => f.Children)
                .HasForeignKey(f => f.ParentFeatureId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(f => f.ParentFeatureId);
            entity.Property(f => f.Source).HasConversion<string>().HasMaxLength(20);
        });

        modelBuilder.Entity<PermissionFeatureCapability>(entity =>
        {
            entity.HasIndex(c => new { c.FeatureId, c.Key }).IsUnique();
            entity.Property(c => c.Key).HasMaxLength(50);
            entity.Property(c => c.DisplayName).HasMaxLength(100);

            entity.HasOne(c => c.Feature)
                .WithMany(f => f.Capabilities)
                .HasForeignKey(c => c.FeatureId)
                .OnDelete(DeleteBehavior.Cascade); // a feature's own capability rows are pure metadata about it, safe to cascade
        });

        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.HasIndex(rp => new { rp.RoleId, rp.FeatureId, rp.Capability }).IsUnique();
            entity.Property(rp => rp.Capability).HasMaxLength(50);

            entity.HasOne(rp => rp.Role)
                .WithMany(r => r.RolePermissions)
                .HasForeignKey(rp => rp.RoleId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(rp => rp.Feature)
                .WithMany(f => f.RolePermissions)
                .HasForeignKey(rp => rp.FeatureId)
                .OnDelete(DeleteBehavior.Restrict); // features are soft-deactivated, never hard-deleted, so this should never fire
        });

        modelBuilder.Entity<UserPermissionOverride>(entity =>
        {
            entity.HasIndex(o => new { o.UserId, o.FeatureId, o.Capability }).IsUnique();
            entity.Property(o => o.Capability).HasMaxLength(50);
            entity.Property(o => o.Effect).HasConversion<string>().HasMaxLength(20);

            entity.HasOne(o => o.User)
                .WithMany(u => u.PermissionOverrides)
                .HasForeignKey(o => o.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(o => o.Feature)
                .WithMany(f => f.UserPermissionOverrides)
                .HasForeignKey(o => o.FeatureId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasIndex(t => t.TokenHash).IsUnique();
            entity.Property(t => t.TokenHash).HasMaxLength(200);
            entity.Property(t => t.CreatedByIp).HasMaxLength(64);

            // Serves the cleanup sweep, which filters on ExpiresAt and would otherwise scan a table
            // that grows by ~96 rows per active user per day.
            entity.HasIndex(t => t.ExpiresAt);

            entity.HasOne(t => t.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasIndex(a => a.OccurredAt);
            entity.HasIndex(a => a.ServiceName);

            // AuditLogs is the fastest-growing table in the system — every login attempt, success or
            // failure, writes a row. These three columns are all filtered or aggregated on and had
            // no index at all.
            //
            // Action backs the two equality counts in SummaryAsync ("auth.login_succeeded" /
            // "auth.login_failed"), which run on every dashboard and audit-page load.
            entity.HasIndex(a => a.Action);

            // ActorUserId backs SummaryAsync's Distinct().Count() for the active-users card.
            entity.HasIndex(a => a.ActorUserId);

            // Composite, and ordered deliberately: the audit page filters by ServiceName/Result and
            // then sorts by OccurredAt descending. Two separate single-column indexes cannot serve
            // "filter then sort" in one pass — Postgres would still need a separate sort step. These
            // let the whole query be satisfied by one index scan.
            entity.HasIndex(a => new { a.ServiceName, a.OccurredAt })
                .IsDescending(false, true);
            entity.HasIndex(a => new { a.Result, a.OccurredAt })
                .IsDescending(false, true);
            entity.Property(a => a.ServiceName).HasMaxLength(100);
            entity.Property(a => a.Action).HasMaxLength(150);
            entity.Property(a => a.ActorName).HasMaxLength(200);
            entity.Property(a => a.EntityType).HasMaxLength(100);
            entity.Property(a => a.EntityId).HasMaxLength(200);
            entity.Property(a => a.SourceIp).HasMaxLength(64);
        });
    }
}
