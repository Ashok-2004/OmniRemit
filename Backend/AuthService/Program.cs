using System.Security.Cryptography;
using AuthService.Application.Services;
using AuthService.Infrastructure;
using AuthService.Infrastructure.Security;
using AuthService.Infrastructure.Seed;
using AuthService.Options;
using DotNetEnv;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

// Load Backend/AuthService/.env (git-ignored) into process environment variables before the host
// reads configuration, so ConnectionStrings__AuthDb etc. resolve the same way real env vars would
// in a deployed environment. Safe to skip silently if the file doesn't exist yet.
Env.TraversePath().Load();

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers(options => options.Filters.Add<AppExceptionFilter>());
builder.Services.AddOpenApi();

builder.Services.Configure<CorsOptions>(builder.Configuration.GetSection(CorsOptions.SectionName));
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.Configure<AuthCookieOptions>(builder.Configuration.GetSection(AuthCookieOptions.SectionName));
builder.Services.Configure<InternalApiOptions>(builder.Configuration.GetSection(InternalApiOptions.SectionName));

var connectionString = builder.Configuration.GetConnectionString("AuthDb");
var isDbConfigured = !string.IsNullOrWhiteSpace(connectionString);

// Always register AuthDbContext — even with a placeholder connection string — so the DI container
// can construct AuthAppService/RefreshTokenService/etc. at boot. With a placeholder, the app still
// starts (and non-DB endpoints like /health work); anything that actually touches the database
// fails at request time with a clear error instead of crashing the whole process on startup.
builder.Services.AddDbContext<AuthDbContext>(options =>
    options.UseNpgsql(isDbConfigured ? connectionString : "Host=unconfigured;Database=unconfigured;Username=unconfigured;Password=unconfigured"));

builder.Services.AddScoped<PasswordHasher>();
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<RefreshTokenService>();
builder.Services.AddScoped<PermissionClaimsBuilder>();
builder.Services.AddScoped<AuthAppService>();
builder.Services.AddScoped<UserAppService>();
builder.Services.AddScoped<RoleAppService>();
builder.Services.AddScoped<PermissionCatalogAppService>();
builder.Services.AddScoped<AuditLogAppService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection($"{CorsOptions.SectionName}:AllowedOrigins").Get<string[]>() ?? [];
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials(); // required: refresh token travels as an httpOnly cookie
    });
});

var jwtSection = builder.Configuration.GetSection(JwtOptions.SectionName);
var configuredPublicKeyPem = jwtSection["SigningKeyPublic"];
var jwtIssuer = jwtSection["Issuer"] ?? "omniremit-auth-service";
var jwtAudience = jwtSection["Audience"] ?? "omniremit-host";

RSA validationRsa;
if (!string.IsNullOrWhiteSpace(configuredPublicKeyPem))
{
    validationRsa = RsaKeyLoader.LoadPublicKey(configuredPublicKeyPem);
}
else
{
    // No real key configured yet — generate ephemeral key material purely so JwtBearer can wire up
    // without crashing the whole app at boot. Any real token will simply fail signature validation
    // (as it should) until Jwt__SigningKeyPublic/Private are set in Backend/AuthService/.env.
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
            IssuerSigningKey = new RsaSecurityKey(validationRsa),
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });

builder.Services.AddAuthorization();

// Ensures ANY unhandled exception (a DB connection blip, a bug) becomes a safe, consistent
// ProblemDetails JSON response instead of a bare/empty 500 the frontend can't parse — AppExceptionFilter
// above only covers the small set of expected domain exceptions; this is the catch-all beneath it.
builder.Services.AddProblemDetails();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler();
}

if (!isDbConfigured)
{
    app.Logger.LogWarning(
        "ConnectionStrings__AuthDb is not set — the app will start, but any endpoint touching the " +
        "database will fail until Backend/AuthService/.env (copied from .env.example) is filled in.");
}
else
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
    await db.Database.MigrateAsync();
    await AuthDbSeeder.SeedAsync(db, app.Logger);
}

if (string.IsNullOrWhiteSpace(configuredPublicKeyPem))
{
    app.Logger.LogWarning(
        "Jwt__SigningKeyPublic/Private are not set — an ephemeral key pair was generated for this " +
        "process only, so no previously issued token (and no token from another instance) will validate. " +
        "Set real values in Backend/AuthService/.env before relying on auth.");
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("Frontend");
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "AuthService" }))
    .WithName("HealthCheck");

app.Run();
