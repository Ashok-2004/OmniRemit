using EmployeeService.Middleware;

namespace EmployeeService.Extensions;

public static class MiddlewareExtensions
{
    public static WebApplication ConfigurePipeline(
        this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();

            app.UseSwaggerUI();
        }

        app.UseMiddleware<ExceptionMiddleware>();

        app.UseAuthorization();

        app.MapHealthChecks("/health");

        app.MapControllers();

        return app;
    }
}