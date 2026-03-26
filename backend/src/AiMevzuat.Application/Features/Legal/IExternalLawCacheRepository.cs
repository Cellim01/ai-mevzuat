using AiMevzuat.Domain.Entities;

namespace AiMevzuat.Application.Features.Legal;

public interface IExternalLawCacheRepository
{
    Task<ExternalLawCache?> GetValidAsync(
        string source,
        string queryHash,
        CancellationToken ct = default);

    Task UpsertAsync(ExternalLawCache entry, CancellationToken ct = default);
}
