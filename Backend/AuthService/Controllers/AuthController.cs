using System.Security.Claims;
using AuthService.Application.Services;
using AuthService.Application.DTOs;
using AuthService.Infrastructure.Security;
using AuthService.Options;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace AuthService.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    AuthAppService authAppService,
    IOptions<AuthCookieOptions> cookieOptions,
    IWebHostEnvironment env) : ControllerBase
{
    private readonly AuthCookieOptions _cookieOptions = cookieOptions.Value;

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        try
        {
            var result = await authAppService.LoginAsync(request.Email, request.Password, ClientIp(), ct);
            SetRefreshCookie(result.RefreshToken, result.RefreshExpiresAt);
            return Ok(new LoginResponse(result.AccessToken, result.ExpiresAt, result.User));
        }
        catch (InvalidCredentialsException)
        {
            return Unauthorized(new ProblemDetails { Title = "Invalid email or password.", Status = 401 });
        }
        catch (AccountInactiveException ex)
        {
            return StatusCode(403, new ProblemDetails { Title = ex.Message, Status = 403 });
        }
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<RefreshResponse>> Refresh(CancellationToken ct)
    {
        var rawToken = Request.Cookies[_cookieOptions.RefreshCookieName];
        if (string.IsNullOrEmpty(rawToken))
        {
            return Unauthorized(new ProblemDetails { Title = "No refresh session present.", Status = 401 });
        }

        try
        {
            var result = await authAppService.RefreshAsync(rawToken, ClientIp(), ct);
            SetRefreshCookie(result.RefreshToken, result.RefreshExpiresAt);
            return Ok(new RefreshResponse(result.AccessToken, result.ExpiresAt, result.User));
        }
        catch (InvalidRefreshTokenException)
        {
            ClearRefreshCookie();
            return Unauthorized(new ProblemDetails { Title = "Refresh session is invalid or has expired.", Status = 401 });
        }
        catch (AccountInactiveException ex)
        {
            ClearRefreshCookie();
            return StatusCode(403, new ProblemDetails { Title = ex.Message, Status = 403 });
        }
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var rawToken = Request.Cookies[_cookieOptions.RefreshCookieName];
        if (!string.IsNullOrEmpty(rawToken))
        {
            await authAppService.LogoutAsync(rawToken, ct);
        }

        ClearRefreshCookie();
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<CurrentUserDto>> Me(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(userId, out var id))
        {
            return Unauthorized();
        }

        var current = await authAppService.GetCurrentUserAsync(id, ct);
        return current is null ? Unauthorized() : Ok(current);
    }

    private void SetRefreshCookie(string rawToken, DateTimeOffset expiresAt)
    {
        var options = new CookieOptions
        {
            HttpOnly = true,
            Secure = !env.IsDevelopment(),
            SameSite = SameSiteMode.Lax,
            Expires = expiresAt,
            Path = "/api/auth",
        };

        if (!string.IsNullOrWhiteSpace(_cookieOptions.RefreshCookieDomain))
        {
            options.Domain = _cookieOptions.RefreshCookieDomain;
        }

        Response.Cookies.Append(_cookieOptions.RefreshCookieName, rawToken, options);
    }

    private void ClearRefreshCookie() => Response.Cookies.Delete(_cookieOptions.RefreshCookieName, new CookieOptions { Path = "/api/auth" });

    private string? ClientIp() => HttpContext.Connection.RemoteIpAddress?.ToString();
}
