using AuthService.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Infrastructure;

public class AuthDbContext(DbContextOptions<AuthDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<PermissionFeature> PermissionFeatures => Set<PermissionFeature>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<UserPermissionOverride> UserPermissionOverrides => Set<UserPermissionOverride>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

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

            entity.HasOne(u => u.Role)
                .WithMany(r => r.Users)
                .HasForeignKey(u => u.RoleId)
                .OnDelete(DeleteBehavior.Restrict); // role deletion is blocked at the app layer while users reference it; this is defense in depth

            entity.HasQueryFilter(u => !u.IsDeleted);
        });

        modelBuilder.Entity<PermissionFeature>(entity =>
        {
            entity.HasIndex(f => f.Key).IsUnique();
            entity.Property(f => f.Key).HasMaxLength(200);
            entity.Property(f => f.DisplayName).HasMaxLength(200);
            entity.Property(f => f.Source).HasConversion<string>().HasMaxLength(20);
        });

        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.HasIndex(rp => new { rp.RoleId, rp.FeatureId, rp.Capability }).IsUnique();
            entity.Property(rp => rp.Capability).HasConversion<string>().HasMaxLength(20);

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
            entity.Property(o => o.Capability).HasConversion<string>().HasMaxLength(20);
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

            entity.HasOne(t => t.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
