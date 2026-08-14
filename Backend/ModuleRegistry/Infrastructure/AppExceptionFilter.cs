using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using ModuleRegistry.Application.Exceptions;

namespace ModuleRegistry.Infrastructure;

public class AppExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        var (status, title) = context.Exception switch
        {
            NotFoundAppException ex => (StatusCodes.Status404NotFound, ex.Message),
            ConflictAppException ex => (StatusCodes.Status409Conflict, ex.Message),
            ValidationAppException ex => (StatusCodes.Status400BadRequest, ex.Message),
            _ => (0, string.Empty),
        };

        if (status == 0)
        {
            return;
        }

        context.Result = new ObjectResult(new ProblemDetails { Title = title, Status = status }) { StatusCode = status };
        context.ExceptionHandled = true;
    }
}
