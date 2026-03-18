using AiMevzuat.Domain.Common;
using AiMevzuat.Domain.Entities;
using AiMevzuat.Domain.Enums;

namespace AiMevzuat.Application.Features.Gazette;

public interface IGazetteRepository : IRepository<GazetteDocument>
{
    Task<(IEnumerable<GazetteDocument> Items, int Total)> GetDocumentsPagedAsync(
        int page,
        int pageSize,
        DocumentCategory? category,
        DateOnly? from,
        DateOnly? to,
        string? search,
        CancellationToken ct = default);

    Task<GazetteDocument?> GetByIdWithIssueAsync(Guid id, CancellationToken ct = default);
}

public interface IUserRepository : IRepository<Domain.Entities.User>
{
    Task<Domain.Entities.User?> GetByEmailAsync(string email, CancellationToken ct = default);
}

public interface IRefreshTokenRepository : IRepository<RefreshToken>
{
    Task<RefreshToken?> GetActiveTokenAsync(string token, CancellationToken ct = default);
}

public interface IGazetteIssueRepository : IRepository<GazetteIssue>
{
    Task<GazetteIssue?> GetByDateAsync(DateOnly date, CancellationToken ct = default);
    Task<GazetteIssue?> GetByIssueNumberAsync(int issueNumber, CancellationToken ct = default);
    Task<(IEnumerable<GazetteIssue> Items, int Total)> GetIssuesPagedAsync(
        int page,
        int pageSize,
        DateOnly? from = null,
        DateOnly? to = null,
        CancellationToken ct = default);
}
