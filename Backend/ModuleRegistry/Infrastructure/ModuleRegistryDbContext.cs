using Microsoft.EntityFrameworkCore;
using ModuleRegistry.Domain.Entities;

namespace ModuleRegistry.Infrastructure;

public class ModuleRegistryDbContext(DbContextOptions<ModuleRegistryDbContext> options) : DbContext(options)
{
    public DbSet<RemoteApp> RemoteApps => Set<RemoteApp>();
    public DbSet<RemoteAppCapability> RemoteAppCapabilities => Set<RemoteAppCapability>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RemoteApp>(entity =>
        {
            entity.HasIndex(a => a.Key).IsUnique();
            entity.HasIndex(a => a.PermissionFeatureKey).IsUnique();
            entity.Property(a => a.Key).HasMaxLength(100);
            entity.Property(a => a.DisplayName).HasMaxLength(200);
            entity.Property(a => a.IconKey).HasMaxLength(100);
            entity.Property(a => a.ManifestUrl).HasMaxLength(2048);
            entity.Property(a => a.MaintenanceMessage).HasMaxLength(2000);
            entity.Property(a => a.PermissionFeatureKey).HasMaxLength(200);
            entity.Property(a => a.PermissionsSourceUrl).HasMaxLength(2048);
            entity.Property(a => a.Status).HasConversion<string>().HasMaxLength(20);
        });

        modelBuilder.Entity<RemoteAppCapability>(entity =>
        {
            entity.HasIndex(c => new { c.RemoteAppId, c.Key }).IsUnique();
            entity.Property(c => c.Key).HasMaxLength(50);
            entity.Property(c => c.DisplayName).HasMaxLength(100);

            entity.HasOne(c => c.RemoteApp)
                .WithMany(a => a.Capabilities)
                .HasForeignKey(c => c.RemoteAppId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
