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
        modelBuilder.Entity<Employee>().Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
    }
}