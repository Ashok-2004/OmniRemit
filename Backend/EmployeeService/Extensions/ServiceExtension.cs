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
        services.AddDbContext<AppDbContext>(options =>
        {
            options.UseNpgsql(
                configuration.GetConnectionString("DefaultConnection"));
        });

        services.AddScoped<IEmployeeRepository, EmployeeRepository>();

        services.AddScoped<IEmployeeService, Services.EmployeeService>();

        services.AddAutoMapper(AppDomain.CurrentDomain.GetAssemblies());

        services.AddValidatorsFromAssemblyContaining<CreateEmployeeValidator>();

        return services;
    }
}