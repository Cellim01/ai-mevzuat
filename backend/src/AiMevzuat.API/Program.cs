using System.Text;
using System.Security.Cryptography;
using AiMevzuat.Infrastructure;
using AiMevzuat.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "AI-Mevzuat API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Bearer {token}"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddMediatR(cfg =>
    cfg.RegisterServicesFromAssembly(
        typeof(AiMevzuat.Application.Features.Auth.RegisterCommand).Assembly));

var jwtSecret = (builder.Configuration["Jwt:Secret"] ?? string.Empty).Trim();
if (!IsValidSecret(jwtSecret))
{
    if (builder.Environment.IsDevelopment())
    {
        jwtSecret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        Console.WriteLine("WARN: Jwt:Secret ayarlanmamis. Development icin gecici secret uretildi.");
    }
    else
    {
        throw new InvalidOperationException(
            "Jwt:Secret guvenli bir deger olmali (en az 32 karakter, placeholder olmamali).");
    }
}

// JwtService IConfiguration uzerinden okudugu icin runtime'da kullanilacak secret'i
// config'e geri yaziyoruz. Boylece auth middleware ve token uretimi ayni secret'i kullanir.
builder.Configuration["Jwt:Secret"] = jwtSecret;

var aiServiceApiKey = (builder.Configuration["AiService:ApiKey"] ?? string.Empty).Trim();
if (LooksLikePlaceholder(aiServiceApiKey))
{
    throw new InvalidOperationException(
        "AiService:ApiKey placeholder deger olamaz. Bos birakabilir veya gercek key verebilirsin.");
}

if (!builder.Environment.IsDevelopment() && string.IsNullOrWhiteSpace(aiServiceApiKey))
{
    throw new InvalidOperationException(
        "Production ortaminda AiService:ApiKey zorunludur.");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

var allowedOrigins = ReadAllowedOrigins(builder.Configuration);
builder.Services.AddCors(opt =>
    opt.AddPolicy("Frontend", policy =>
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "ai-mevzuat-backend" })).AllowAnonymous();

app.Run();

static string[] ReadAllowedOrigins(IConfiguration configuration)
{
    var sectionOrigins = configuration.GetSection("AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
    var csvOrigins = (configuration["AllowedOrigins"] ?? string.Empty)
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    var origins = sectionOrigins
        .Concat(csvOrigins)
        .Select(x => (x ?? string.Empty).Trim())
        .Where(IsValidOrigin)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

    if (origins.Length > 0)
        return origins;

    return new[]
    {
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174"
    };
}

static bool IsValidOrigin(string value)
{
    if (string.IsNullOrWhiteSpace(value))
        return false;

    if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
        return false;

    return uri.Scheme is "http" or "https";
}

static bool IsValidSecret(string value)
{
    if (string.IsNullOrWhiteSpace(value))
        return false;

    if (value.Length < 32)
        return false;

    return !LooksLikePlaceholder(value);
}

static bool LooksLikePlaceholder(string value)
{
    if (string.IsNullOrWhiteSpace(value))
        return false;

    var normalized = value.Trim().ToLowerInvariant();
    return normalized.Contains("degistir")
           || normalized.Contains("placeholder")
           || normalized.Contains("gizli-anahtar")
           || normalized.Contains("set_via_env")
           || normalized.Contains("set-from-env");
}
