using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using backend.Data;
using backend.Controllers;

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
var configuredOrigins = builder.Configuration
    .GetSection("AllowedOrigins")
    .Get<string[]>();

var corsOrigins = (configuredOrigins != null && configuredOrigins.Length > 0)
    ? configuredOrigins
    : new[] { "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://localhost:3000", "http://localhost:5001", "http://localhost:5002", "http://localhost:5003" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.SetIsOriginAllowed(origin => true)
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
