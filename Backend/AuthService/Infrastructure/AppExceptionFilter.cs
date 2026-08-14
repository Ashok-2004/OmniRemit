using AuthService.Application.Exceptions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace AuthService.Infrastructure;

/// <summary>Maps the small set of domain exceptions Application/Services throws onto the right HTTP status, as ProblemDetails.</summary>
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
            return; // not ours — let the default developer/production exception handling deal with it
        }

        context.Result = new ObjectResult(new ProblemDetails { Title = title, Status = status }) { StatusCode = status };
        context.ExceptionHandled = true;
    }
}
