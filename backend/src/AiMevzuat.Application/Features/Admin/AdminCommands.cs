using AiMevzuat.Application.Common.Interfaces;
using AiMevzuat.Application.Features.Legal;
using MediatR;

namespace AiMevzuat.Application.Features.Admin;

public record GetAiHealthQuery : IRequest<string?>;
public record ListAiJobsQuery : IRequest<string?>;
public record GetAiJobStatusQuery(string JobId) : IRequest<string?>;
public record TriggerRawScrapeCommand(DateOnly Date, RawScrapeOptions Options) : IRequest<string?>;
public record GetRawOutputQuery(DateOnly Date, int Limit = 20) : IRequest<string?>;
public record ClearExternalLawCacheCommand(string? Query = null) : IRequest<ClearExternalLawCacheResult>;

public record ClearExternalLawCacheResult(int Deleted, string Query, string Message);

public class GetAiHealthQueryHandler : IRequestHandler<GetAiHealthQuery, string?>
{
    private readonly IAiServiceClient _aiServiceClient;

    public GetAiHealthQueryHandler(IAiServiceClient aiServiceClient) => _aiServiceClient = aiServiceClient;

    public Task<string?> Handle(GetAiHealthQuery request, CancellationToken ct)
        => _aiServiceClient.GetHealthAsync(ct);
}

public class ListAiJobsQueryHandler : IRequestHandler<ListAiJobsQuery, string?>
{
    private readonly IAiServiceClient _aiServiceClient;

    public ListAiJobsQueryHandler(IAiServiceClient aiServiceClient) => _aiServiceClient = aiServiceClient;

    public Task<string?> Handle(ListAiJobsQuery request, CancellationToken ct)
        => _aiServiceClient.ListJobsAsync(ct);
}

public class GetAiJobStatusQueryHandler : IRequestHandler<GetAiJobStatusQuery, string?>
{
    private readonly IAiServiceClient _aiServiceClient;

    public GetAiJobStatusQueryHandler(IAiServiceClient aiServiceClient) => _aiServiceClient = aiServiceClient;

    public Task<string?> Handle(GetAiJobStatusQuery request, CancellationToken ct)
        => _aiServiceClient.GetJobStatusAsync(request.JobId, ct);
}

public class TriggerRawScrapeCommandHandler : IRequestHandler<TriggerRawScrapeCommand, string?>
{
    private readonly IAiServiceClient _aiServiceClient;

    public TriggerRawScrapeCommandHandler(IAiServiceClient aiServiceClient) => _aiServiceClient = aiServiceClient;

    public Task<string?> Handle(TriggerRawScrapeCommand request, CancellationToken ct)
        => _aiServiceClient.ScrapeRawAsync(request.Date, request.Options, ct);
}

public class GetRawOutputQueryHandler : IRequestHandler<GetRawOutputQuery, string?>
{
    private readonly IAiServiceClient _aiServiceClient;

    public GetRawOutputQueryHandler(IAiServiceClient aiServiceClient) => _aiServiceClient = aiServiceClient;

    public Task<string?> Handle(GetRawOutputQuery request, CancellationToken ct)
        => _aiServiceClient.GetRawOutputAsync(request.Date, request.Limit, ct);
}

public class ClearExternalLawCacheCommandHandler : IRequestHandler<ClearExternalLawCacheCommand, ClearExternalLawCacheResult>
{
    private readonly IExternalLawCacheRepository _externalLawCacheRepository;

    public ClearExternalLawCacheCommandHandler(IExternalLawCacheRepository externalLawCacheRepository)
        => _externalLawCacheRepository = externalLawCacheRepository;

    public async Task<ClearExternalLawCacheResult> Handle(ClearExternalLawCacheCommand request, CancellationToken ct)
    {
        var deleted = await _externalLawCacheRepository.ClearAsync(request.Query, ct);
        var normalizedQuery = request.Query ?? string.Empty;
        var message = deleted == 0
            ? "Silinecek cache kaydi bulunamadi."
            : $"{deleted} cache kaydi silindi.";

        return new ClearExternalLawCacheResult(deleted, normalizedQuery, message);
    }
}
