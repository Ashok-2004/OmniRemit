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

        // ExceptionMiddleware is deliberately NOT here — it is registered in Program.cs before
        // UseCors/UseAuthentication so it can actually catch auth-pipeline exceptions and still
        // emit CORS headers on the error response.
        app.UseAuthorization();

        app.MapHealthChecks("/health");

        app.MapControllers();

        return app;
    }
}