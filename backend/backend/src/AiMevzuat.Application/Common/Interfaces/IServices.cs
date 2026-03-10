using AiMevzuat.Domain.Entities;

namespace AiMevzuat.Application.Common.Interfaces;

public interface IJwtService
{
    string GenerateAccessToken(User user);
    string GenerateRefreshToken();
    Guid? ValidateAccessToken(string token);
}

public interface ICurrentUserService
{
    Guid? UserId { get; }
    string? Email { get; }
    bool IsAuthenticated { get; }
}

public interface IPasswordService
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

public interface IAiServiceClient
{
    Task<string?> GetDocumentSummaryAsync(string text, CancellationToken ct = default);
    Task TriggerScrapeAsync(DateOnly date, CancellationToken ct = default);
}
