using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.IdentityModel.Tokens;
using backend.Data;
using backend.Controllers;
using backend.Middleware;

// ---------------------------------------------------------------------------
// Load local .env file if present
// ---------------------------------------------------------------------------
var envPaths = new[]
{
    Path.Combine(Directory.GetCurrentDirectory(), ".env"),
    Path.Combine(Directory.GetCurrentDirectory(), "Backend", "Customer360Service", ".env"),
    Path.Combine(AppContext.BaseDirectory, ".env")
};

foreach (var path in envPaths)
{
    if (File.Exists(path))
    {
        foreach (var line in File.ReadAllLines(path))
        {
            if (string.IsNullOrWhiteSpace(line) || line.StartsWith("#")) continue;
            var parts = line.Split('=', 2);
            if (parts.Length == 2)
            {
                Environment.SetEnvironmentVariable(parts[0].Trim(), parts[1].Trim());
            }
        }
        break;
    }
}

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------------
// Controllers + JSON serialization
// ---------------------------------------------------------------------------
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new backend.Data.DualNamingConverterFactory());
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSingleton<CrmProxyService>();
builder.Services.AddSingleton<AuditRepository>();

// ---------------------------------------------------------------------------
// CORS Policy
// ---------------------------------------------------------------------------
// Reads Cors:AllowedOrigins, matching AuthService/ModuleRegistry/EmployeeService/LeadService exactly
// — this service previously used a differently-named flat "AllowedOrigins" key, computed it into
// `corsOrigins`, and then never used that variable: the actual policy was
// SetIsOriginAllowed(_ => true), i.e. any origin, regardless of what was configured. Fail-closed
// (WithOrigins, no wildcard fallback) matches the platform's other services rather than LeadService's
// permissive-if-empty fallback — appropriate here because real origins are now set in .env.
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// ---------------------------------------------------------------------------
// Authentication — RS256 JWT Token Validation (OmniRemit Platform Standard)
// ---------------------------------------------------------------------------
var jwtSection = builder.Configuration.GetSection("Jwt");
var configuredPublicKeyPem = jwtSection["SigningKeyPublic"] ?? Environment.GetEnvironmentVariable("JWT_SIGNING_KEY_PUBLIC") ?? Environment.GetEnvironmentVariable("Jwt__SigningKeyPublic");
var jwtIssuer = jwtSection["Issuer"] ?? "omniremit-auth-service";
var jwtAudience = jwtSection["Audience"] ?? "omniremit-host";

RSA validationRsa;
if (!string.IsNullOrWhiteSpace(configuredPublicKeyPem))
{
    var rsa = RSA.Create();
    rsa.ImportFromPem(configuredPublicKeyPem.Replace("\\n", "\n"));
    validationRsa = rsa;
}
else
{
    // Ephemeral key so the service boots cleanly before Jwt__SigningKeyPublic is provided
    validationRsa = RSA.Create(2048);
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Preserve short claim names ("sub", "perms", "admin") without legacy WS-Security URI remapping
        options.MapInboundClaims = false;
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidAlgorithms = [SecurityAlgorithms.RsaSha256],
            IssuerSigningKey = new RsaSecurityKey(validationRsa),
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });

builder.Services.AddAuthorization();

// ---------------------------------------------------------------------------
// Build and configure the middleware pipeline
// ---------------------------------------------------------------------------
var app = builder.Build();

// First middleware, matching AuthService/ModuleRegistry/EmployeeService: behind a TLS-terminating
// proxy the real scheme and client IP arrive only as X-Forwarded-* headers. KnownNetworks/KnownProxies
// are cleared because the platform assigns the proxy address dynamically; safe only because this
// container is reachable solely via that proxy.
var forwardedHeaders = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
};
forwardedHeaders.KnownNetworks.Clear();
forwardedHeaders.KnownProxies.Clear();
app.UseForwardedHeaders(forwardedHeaders);

// Before CORS/auth, matching EmployeeService — otherwise anything thrown by the auth handler bypasses
// it entirely and comes back as a bare 500 with no CORS headers, which the browser reports as an
// opaque CORS failure rather than the real error.
app.UseMiddleware<ExceptionMiddleware>();

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

if (string.IsNullOrWhiteSpace(configuredPublicKeyPem))
{
    app.Logger.LogWarning(
        "Jwt__SigningKeyPublic is not set — an ephemeral RSA key was generated for this process only.");
}
else
{
    app.Logger.LogInformation("RS256 JWT Public Key loaded successfully.");
}

app.Run();
