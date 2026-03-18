using AiMevzuat.Application.Common.Interfaces;
using AiMevzuat.Application.Features.Gazette;
using AiMevzuat.Domain.Common;
using AiMevzuat.Domain.Entities;
using AiMevzuat.Infrastructure.Identity;
using AiMevzuat.Infrastructure.Persistence;
using AiMevzuat.Infrastructure.Persistence.Repositories;
using AiMevzuat.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AiMevzuat.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration config)
    {
        // EF Core — MSSQL
        services.AddDbContext<AppDbContext>(opt =>
            opt.UseSqlServer(
                config.GetConnectionString("DefaultConnection"),
                sql => sql.EnableRetryOnFailure(3)
            ));

        // Repositories
        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<IGazetteRepository, GazetteRepository>();
        services.AddScoped<IGazetteIssueRepository, GazetteIssueRepository>();

        // Identity services
        services.AddScoped<IJwtService, JwtService>();
        services.AddScoped<IPasswordService, PasswordService>();
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        // AI Service client
        services.AddHttpClient<IAiServiceClient, AiServiceClient>();

        return services;
    }
}
