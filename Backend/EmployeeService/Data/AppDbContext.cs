using Microsoft.EntityFrameworkCore;
using EmployeeService.Models;

namespace EmployeeService.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<Employee> Employees => Set<Employee>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Employee>(entity =>
        {
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");

            // Lengths were previously unbounded `text` on every column — the only service in the
            // solution without them. Bounds are a cheap integrity guard and let Postgres plan better.
            entity.Property(e => e.Name).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Email).HasMaxLength(320).IsRequired();
            entity.Property(e => e.Department).HasMaxLength(150).IsRequired();

            // Money must not be a floating-point type. Postgres maps decimal to `numeric` here, but
            // being explicit about precision/scale stops a provider default from silently rounding.
            entity.Property(e => e.Salary).HasPrecision(18, 2);

            // This table previously had NO indexes at all beyond its primary key, while the list
            // endpoint sorts by Name and filters across Name/Email/Department on every request.
            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.Name);
            entity.HasIndex(e => e.Department);
        });
    }
}