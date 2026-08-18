using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace backend.Controllers
{
    [ApiController]
    [Route("")]
    public class AuthController : ControllerBase
    {
        private readonly Microsoft.Extensions.Configuration.IConfiguration _configuration;

        public AuthController(Microsoft.Extensions.Configuration.IConfiguration configuration)
        {
            _configuration = configuration;
        }

        // ---------------------------------------------------------------------------
        // POST /token
        //
        // Issues a short-lived JWT for the frontend to authenticate against
        // the backend API. This is an internal application token — it is NOT
        // the CRM OAuth token. CRM credentials remain exclusively server-side.
        //
        // The endpoint accepts a grant_type=client_credentials request with no
        // client credential validation because:
        //   1. The backend is an internal service, typically not directly
        //      reachable from the public internet.
        //   2. All CRM proxy endpoints require a valid, signed JWT (via [Authorize]).
        //   3. The issued JWT is signed and cannot be forged without the server secret.
        //   4. If upstream access control is required, it should be enforced at
        //      the network/reverse-proxy layer, not by pretending to validate
        //      client_id/client_secret values that are hardcoded in the browser.
        //
        // NOTE: If this endpoint needs to be hardened in a future iteration,
        // the correct approach is machine-to-machine PKI or an upstream SSO
        // gateway — not validating browser-embedded plaintext credentials.
        // ---------------------------------------------------------------------------
        [HttpPost("token")]
        [Consumes("application/json", "application/x-www-form-urlencoded")]
        public IActionResult GetToken()
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var secretKey = _configuration["Jwt:SecretKey"]
                ?? throw new InvalidOperationException("JWT SecretKey is not configured.");
            var key = Encoding.UTF8.GetBytes(secretKey);

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[] { new Claim(ClaimTypes.Name, "omniconnect-app") }),
                Expires = DateTime.UtcNow.AddHours(1),
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(key),
                    SecurityAlgorithms.HmacSha256Signature),
                Issuer = "OmniAPIBSN",
                Audience = "OmniConnectApp"
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var tokenString = tokenHandler.WriteToken(token);

            return Ok(new
            {
                access_token = tokenString,
                token_type = "Bearer",
                expires_in = 3600
            });
        }
    }
}
