using System.Security.Cryptography;
using DotNetEnv;
using EmployeeService.Extensions;
using EmployeeService.Infrastructure;
using EmployeeService.Options;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

// Load Backend/EmployeeService/.env (git-ignored) before configuration is read — mirrors AuthService/ModuleRegistry's Program.cs.
Env.TraversePath().Load();

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
// AddHealthChecks() with no checks registered always reported healthy — it could not fail even with
// the database completely unreachable. Now it actually verifies the DbContext can connect.
builder.Services.AddHealthChecks().AddDbContextCheck<EmployeeService.Data.AppDbContext>("database");

builder.Services.AddResponseCompression(options => options.EnableForHttps = true);

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen();

builder.Services.Configure<CorsOptions>(builder.Configuration.GetSection(CorsOptions.SectionName));
builder.Services.Configure<JwtValidationOptions>(builder.Configuration.GetSection(JwtValidationOptions.SectionName));
builder.Services.Configure<AuthIntegrationOptions>(builder.Configuration.GetSection(AuthIntegrationOptions.SectionName));

builder.Services.AddApplicationServices(builder.Configuration);
builder.Services.AddHttpClient<AuthServiceClient>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection($"{CorsOptions.SectionName}:AllowedOrigins").Get<string[]>() ?? [];
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var jwtSection = builder.Configuration.GetSection(JwtValidationOptions.SectionName);
var configuredPublicKeyPem = jwtSection["SigningKeyPublic"];
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
    // Ephemeral key so the app can boot before Jwt__SigningKeyPublic is set — see AuthService's
    // Program.cs for the identical rationale. No real token (from AuthService or anywhere else)
    // will validate until the real public key is configured here.
    validationRsa = RSA.Create(2048);
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Without this, the JWT handler silently remaps short claim names ("sub" in particular) to
        // legacy long-form ClaimTypes URIs before they ever reach a controller — so every
        // User.FindFirst(JwtRegisteredClaimNames.Sub) here and in every other service comes back
        // null even though the token clearly has a "sub" claim. "name" happens not to be in that
        // remap table, which is why actor *names* came through fine while actor *ids* silently didn't.
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,

            // Pin the signature algorithm explicitly. The RsaSecurityKey above already makes an HMAC

            // confusion attack fail, but naming the accepted algorithm is the belt-and-braces form and

            // is what an auditor looks for: it makes "alg" non-negotiable rather than key-type-dependent.

            ValidAlgorithms = [SecurityAlgorithms.RsaSha256],
            IssuerSigningKey = new RsaSecurityKey(validationRsa),
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

app.UsePathBase("/api/employee-service");

// Exception handling must sit OUTSIDE authentication and CORS, not inside. It used to be registered
// within ConfigurePipeline() — i.e. after UseAuthentication — so anything thrown by the auth handler
// bypassed it entirely and came back as a bare 500 with no CORS headers. The browser then reported
// that as an opaque CORS failure, hiding the actual error completely. AuthService and ModuleRegistry
// both put their exception handler first for the same reason.
app.UseMiddleware<EmployeeService.Middleware.ExceptionMiddleware>();

app.UseResponseCompression();

app.UseCors("AllowFrontend");

app.UseAuthentication();

app.ConfigurePipeline();

var connectionString = builder.Configuration.GetConnectionString("EmployeeDb");
if (string.IsNullOrWhiteSpace(connectionString))
{
    app.Logger.LogWarning(
        "ConnectionStrings__EmployeeDb is not set — the app will start, but any endpoint touching the " +
        "database will fail until Backend/EmployeeService/.env (copied from .env.example) is filled in.");
}
else
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<EmployeeService.Data.AppDbContext>();
    await db.Database.MigrateAsync();
}

if (string.IsNullOrWhiteSpace(configuredPublicKeyPem))
{
    app.Logger.LogWarning(
        "Jwt__SigningKeyPublic is not set — an ephemeral key was generated for this process only, " +
        "so no token issued by the real AuthService will validate until it's configured to match.");
}

app.Run();
