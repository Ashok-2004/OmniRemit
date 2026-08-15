using EmployeeService.Data;
using EmployeeService.Interfaces.IRepository;
using EmployeeService.Interfaces.IServices;
using EmployeeService.Repositories;
using EmployeeService.Services;
using EmployeeService.Validators;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace EmployeeService.Extensions;

public static class ServiceExtensions
{
    public static IServiceCollection AddApplicationServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("EmployeeDb");
        var isDbConfigured = !string.IsNullOrWhiteSpace(connectionString);

        // Always register AppDbContext — even with a placeholder connection string — so the DI
        // container can construct EmployeeService/EmployeeRepository at boot. With a placeholder,
        // the app still starts (health checks and /permissions still work); anything that actually
        // touches the database fails at request time with a clear error instead of crashing the
        // whole process on startup. Mirrors AuthService/ModuleRegistry's identical pattern.
        services.AddDbContext<AppDbContext>(options =>
        {
            options.UseNpgsql(isDbConfigured ? connectionString : "Host=unconfigured;Database=unconfigured;Username=unconfigured;Password=unconfigured");
        });

        services.AddScoped<IEmployeeRepository, EmployeeRepository>();

        services.AddScoped<IEmployeeService, Services.EmployeeService>();

        services.AddAutoMapper(AppDomain.CurrentDomain.GetAssemblies());

        services.AddValidatorsFromAssemblyContaining<CreateEmployeeValidator>();

        return services;
    }
}