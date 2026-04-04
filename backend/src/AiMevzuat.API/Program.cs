using System.Text;
using System.Security.Cryptography;
using System.Data;
using System.Data.Common;
using AiMevzuat.Infrastructure;
using AiMevzuat.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);
LoadDotEnvIntoConfiguration(
    builder.Configuration,
    Path.Combine(builder.Environment.ContentRootPath, ".env"));

ValidateConnectionString(builder.Configuration);
ValidateAiServiceBaseUrl(builder.Configuration);
ValidateGroqConfiguration(builder.Configuration);

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
    try
    {
        await db.Database.MigrateAsync();
    }
    catch (Exception ex)
    {
        throw new InvalidOperationException(
            "Veritabani migration uygulanamadi. Connection string ve migration zincirini kontrol et.",
            ex);
    }

    await ValidateDatabaseSchemaAsync(db);
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

static void ValidateConnectionString(IConfiguration configuration)
{
    var conn = (configuration.GetConnectionString("DefaultConnection") ?? string.Empty).Trim();
    if (string.IsNullOrWhiteSpace(conn))
    {
        throw new InvalidOperationException(
            "ConnectionStrings:DefaultConnection bos olamaz.");
    }

    if (LooksLikePlaceholder(conn))
    {
        throw new InvalidOperationException(
            "ConnectionStrings:DefaultConnection placeholder deger olamaz.");
    }

    if (!conn.Contains(';'))
    {
        throw new InvalidOperationException(
            "ConnectionStrings:DefaultConnection gecersiz gorunuyor.");
    }
}

static void ValidateAiServiceBaseUrl(IConfiguration configuration)
{
    var raw = (configuration["AiService:BaseUrl"] ?? string.Empty).Trim();
    if (string.IsNullOrWhiteSpace(raw))
    {
        throw new InvalidOperationException("AiService:BaseUrl bos olamaz.");
    }

    if (!IsValidHttpUrl(raw))
    {
        throw new InvalidOperationException(
            "AiService:BaseUrl gecerli bir http/https URL olmali.");
    }
}

static void ValidateGroqConfiguration(IConfiguration configuration)
{
    var groqEnabled = ParseBool(configuration["GroqLlm:Enabled"]);
    if (!groqEnabled)
        return;

    var groqApiKey = (configuration["GroqLlm:ApiKey"] ?? string.Empty).Trim();
    if (string.IsNullOrWhiteSpace(groqApiKey) || LooksLikePlaceholder(groqApiKey))
    {
        throw new InvalidOperationException(
            "GroqLlm:Enabled=true iken GroqLlm:ApiKey bos/placeholder olamaz.");
    }
}

static bool IsValidSecret(string value)
{
    if (string.IsNullOrWhiteSpace(value))
        return false;

    if (value.Length < 32)
        return false;

    return !LooksLikePlaceholder(value);
}

static bool IsValidHttpUrl(string value)
{
    if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
        return false;

    return uri.Scheme is "http" or "https";
}

static bool ParseBool(string? value)
{
    return bool.TryParse(value, out var result) && result;
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

static void LoadDotEnvIntoConfiguration(IConfiguration configuration, string envFilePath)
{
    if (!File.Exists(envFilePath))
        return;

    foreach (var rawLine in File.ReadAllLines(envFilePath))
    {
        var line = rawLine?.Trim();
        if (string.IsNullOrWhiteSpace(line))
            continue;
        if (line.StartsWith("#", StringComparison.Ordinal))
            continue;

        var idx = line.IndexOf('=');
        if (idx <= 0)
            continue;

        var key = line[..idx].Trim();
        var value = line[(idx + 1)..].Trim();
        if (key.Length == 0)
            continue;

        if ((value.StartsWith('"') && value.EndsWith('"')) ||
            (value.StartsWith('\'') && value.EndsWith('\'')))
        {
            value = value[1..^1];
        }

        // .env'te nested config icin "__" kullanilir: GroqLlm__ApiKey
        var configKey = key.Replace("__", ":", StringComparison.Ordinal);
        configuration[configKey] = value;
        Environment.SetEnvironmentVariable(key, value);
    }
}

static async Task ValidateDatabaseSchemaAsync(AppDbContext db, CancellationToken ct = default)
{
    var requiredTables = new[]
    {
        "Users",
        "RefreshTokens",
        "GazetteIssues",
        "GazetteDocuments",
        "ExternalLawCaches",
    };

    var requiredColumns = new Dictionary<string, string[]>
    {
        ["GazetteDocuments"] = new[]
        {
            "Title",
            "RawText",
            "SearchText",
            "TableDetected",
            "RgSection",
            "RgSubSection",
            "IsVectorized",
            "MilvusVectorId",
        },
        ["GazetteIssues"] = new[]
        {
            "IssueNumber",
            "PublishedDate",
        },
        ["ExternalLawCaches"] = new[]
        {
            "QueryHash",
            "ExpiresAt",
        },
    };

    var missingTables = new List<string>();
    var missingColumns = new List<string>();

    await using var conn = db.Database.GetDbConnection();
    if (conn.State != ConnectionState.Open)
        await conn.OpenAsync(ct);

    foreach (var table in requiredTables)
    {
        if (!await TableExistsAsync(conn, "dbo", table, ct))
            missingTables.Add(table);
    }

    foreach (var (table, columns) in requiredColumns)
    {
        foreach (var column in columns)
        {
            if (!await ColumnExistsAsync(conn, "dbo", table, column, ct))
                missingColumns.Add($"{table}.{column}");
        }
    }

    if (missingTables.Count == 0 && missingColumns.Count == 0)
        return;

    var message =
        "Veritabani semasi kodla uyumlu degil. " +
        (missingTables.Count > 0 ? $"Eksik tablolar: {string.Join(", ", missingTables)}. " : string.Empty) +
        (missingColumns.Count > 0 ? $"Eksik kolonlar: {string.Join(", ", missingColumns)}. " : string.Empty) +
        "Cozum: 'dotnet ef database update --project ..\\AiMevzuat.Infrastructure --startup-project .' komutunu calistir.";

    throw new InvalidOperationException(message);
}

static async Task<bool> TableExistsAsync(
    DbConnection conn,
    string schema,
    string table,
    CancellationToken ct)
{
    await using var cmd = conn.CreateCommand();
    cmd.CommandText = @"
SELECT COUNT(1)
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table";

    AddParameter(cmd, "@schema", schema);
    AddParameter(cmd, "@table", table);

    var result = await cmd.ExecuteScalarAsync(ct);
    return Convert.ToInt32(result) > 0;
}

static async Task<bool> ColumnExistsAsync(
    DbConnection conn,
    string schema,
    string table,
    string column,
    CancellationToken ct)
{
    await using var cmd = conn.CreateCommand();
    cmd.CommandText = @"
SELECT COUNT(1)
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table AND COLUMN_NAME = @column";

    AddParameter(cmd, "@schema", schema);
    AddParameter(cmd, "@table", table);
    AddParameter(cmd, "@column", column);

    var result = await cmd.ExecuteScalarAsync(ct);
    return Convert.ToInt32(result) > 0;
}

static void AddParameter(DbCommand cmd, string name, object value)
{
    var p = cmd.CreateParameter();
    p.ParameterName = name;
    p.Value = value;
    cmd.Parameters.Add(p);
}
