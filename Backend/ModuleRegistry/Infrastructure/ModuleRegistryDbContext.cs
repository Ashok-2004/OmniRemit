using Microsoft.EntityFrameworkCore;
using ModuleRegistry.Domain.Entities;

namespace ModuleRegistry.Infrastructure;

public class ModuleRegistryDbContext(DbContextOptions<ModuleRegistryDbContext> options) : DbContext(options)
{
    public DbSet<RemoteApp> RemoteApps => Set<RemoteApp>();

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
            entity.Property(a => a.Status).HasConversion<string>().HasMaxLength(20);
        });
    }
}
