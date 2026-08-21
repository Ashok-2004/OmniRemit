using System.Security.Cryptography;
using System.Text;
using ModuleRegistry.Options;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;

namespace ModuleRegistry.Infrastructure.Security;

/// <summary>
/// Guards internal/approvals/apply — the endpoint AuthService calls to replay an approved mutation that
/// originated here. Not JWT auth — a static shared secret compared against the X-Internal-Api-Key
/// header. Mirrors AuthService's own InternalApiKeyFilter exactly (no shared package).
/// </summary>
/// <remarks>
/// An <see cref="IAsyncAuthorizationFilter"/>, not an action filter, for the same reason as
/// RequirePermissionAttribute in this codebase: as an action filter it would run after model binding,
/// so [ApiController]'s automatic ModelState 400 would answer before the key was ever checked.
///
/// The comparison is constant-time (hash-then-compare, so even a length mismatch doesn't return early)
/// rather than string.Equals, which leaks how many leading bytes matched via response timing.
/// </remarks>
public class InternalApiKeyFilter(IOptions<InternalApiOptions> options) : IAsyncAuthorizationFilter
{
    private const string HeaderName = "X-Internal-Api-Key";

    public Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var expected = options.Value.ApiKey;

        // Fails closed: with no key configured the internal surface is unusable rather than open.
        if (string.IsNullOrWhiteSpace(expected))
        {
            context.Result = new ObjectResult(new ProblemDetails
            {
                Title = "Internal API key is not configured on this service.",
                Status = StatusCodes.Status503ServiceUnavailable,
            })
            { StatusCode = StatusCodes.Status503ServiceUnavailable };
            return Task.CompletedTask;
        }

        var provided = context.HttpContext.Request.Headers[HeaderName].ToString();
        if (!FixedTimeEquals(provided, expected))
        {
            context.Result = new UnauthorizedObjectResult(new ProblemDetails
            {
                Title = "Missing or invalid internal API key.",
                Status = StatusCodes.Status401Unauthorized,
            });
        }

        return Task.CompletedTask;
    }

    private static bool FixedTimeEquals(string provided, string expected)
    {
        Span<byte> providedHash = stackalloc byte[32];
        Span<byte> expectedHash = stackalloc byte[32];
        SHA256.HashData(Encoding.UTF8.GetBytes(provided), providedHash);
        SHA256.HashData(Encoding.UTF8.GetBytes(expected), expectedHash);
        return CryptographicOperations.FixedTimeEquals(providedHash, expectedHash);
    }
}
