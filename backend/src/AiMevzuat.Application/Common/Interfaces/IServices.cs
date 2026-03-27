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
    Task TriggerScrapeAsync(DateOnly date, CancellationToken ct = default);
    Task<string?> GetHealthAsync(CancellationToken ct = default);
    Task<string?> ListJobsAsync(CancellationToken ct = default);
    Task<string?> GetJobStatusAsync(string jobId, CancellationToken ct = default);
    Task<string?> ScrapeRawAsync(DateOnly date, RawScrapeOptions? options = null, CancellationToken ct = default);
    Task<string?> GetRawOutputAsync(DateOnly date, int limit = 20, CancellationToken ct = default);
}

public record RawScrapeOptions(
    int MaxDocs = 0,
    bool IncludeMainPdf = false,
    bool KeepDebugImages = false,
    bool AllowTablePages = false,
    bool SaveToBackend = true,
    List<string>? OnlyUrls = null,
    int PreviewLimit = 20
);

public record ExternalLawResult(
    string Source,
    string ExternalId,
    string Title,
    string Content,
    string? SourceUrl = null,
    string? MetadataJson = null
);

public interface IExternalLawClient
{
    Task<IReadOnlyList<ExternalLawResult>> QueryAsync(
        string query,
        int maxResults = 5,
        CancellationToken ct = default);
}
