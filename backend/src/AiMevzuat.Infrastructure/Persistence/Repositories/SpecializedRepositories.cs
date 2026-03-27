using AiMevzuat.Application.Features.Gazette;
using AiMevzuat.Application.Features.Legal;
using AiMevzuat.Domain.Entities;
using AiMevzuat.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AiMevzuat.Infrastructure.Persistence.Repositories;

// ── User Repository ───────────────────────────────────────────────────────────
public class UserRepository : Repository<User>, IUserRepository
{
    public UserRepository(AppDbContext db) : base(db) { }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken ct = default)
        => await _set.FirstOrDefaultAsync(u => u.Email == email, ct);
}

// ── RefreshToken Repository ───────────────────────────────────────────────────
public class RefreshTokenRepository : Repository<RefreshToken>, IRefreshTokenRepository
{
    public RefreshTokenRepository(AppDbContext db) : base(db) { }

    public async Task<RefreshToken?> GetActiveTokenAsync(string token, CancellationToken ct = default)
        => await _set
            .Include(t => t.User)
            .FirstOrDefaultAsync(
                t => t.Token == token && t.RevokedAt == null && t.ExpiresAt > DateTime.UtcNow,
                ct);
}

// ── Gazette Repository ────────────────────────────────────────────────────────
public class GazetteRepository : Repository<GazetteDocument>, IGazetteRepository
{
    public GazetteRepository(AppDbContext db) : base(db) { }

    public async Task<(IEnumerable<GazetteDocument> Items, int Total)> GetDocumentsPagedAsync(
        int page,
        int pageSize,
        DocumentCategory? category,
        DateOnly? from,
        DateOnly? to,
        string? search,
        CancellationToken ct = default)
    {
        var query = _set.Include(d => d.Issue).AsQueryable();

        if (category.HasValue)
            query = query.Where(d => d.Category == category.Value);

        if (from.HasValue)
            query = query.Where(d => d.Issue.PublishedDate >= from.Value);

        if (to.HasValue)
            query = query.Where(d => d.Issue.PublishedDate <= to.Value);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(d =>
                d.Title.Contains(search) ||
                (d.Summary != null && d.Summary.Contains(search)) ||
                d.SearchText.Contains(search) ||
                d.RawText.Contains(search));

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(d => d.Issue.PublishedDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<GazetteDocument?> GetByIdWithIssueAsync(Guid id, CancellationToken ct = default)
        => await _set.Include(d => d.Issue).FirstOrDefaultAsync(d => d.Id == id, ct);
}

// ── GazetteIssue Repository ───────────────────────────────────────────────────
public class GazetteIssueRepository : Repository<GazetteIssue>, IGazetteIssueRepository
{
    public GazetteIssueRepository(AppDbContext db) : base(db) { }

    public async Task<GazetteIssue?> GetByDateAsync(DateOnly date, CancellationToken ct = default)
        => await _set.FirstOrDefaultAsync(i => i.PublishedDate == date, ct);

    public async Task<GazetteIssue?> GetByIssueNumberAsync(int issueNumber, CancellationToken ct = default)
        => await _set.FirstOrDefaultAsync(i => i.IssueNumber == issueNumber, ct);

    public async Task<(IEnumerable<GazetteIssue> Items, int Total)> GetIssuesPagedAsync(
        int page,
        int pageSize,
        DateOnly? from = null,
        DateOnly? to = null,
        CancellationToken ct = default)
    {
        var query = _set.AsQueryable();

        if (from.HasValue)
            query = query.Where(i => i.PublishedDate >= from.Value);

        if (to.HasValue)
            query = query.Where(i => i.PublishedDate <= to.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(i => i.PublishedDate)
            .ThenByDescending(i => i.IssueNumber)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }
}

public class ExternalLawCacheRepository : IExternalLawCacheRepository
{
    private readonly AppDbContext _db;

    public ExternalLawCacheRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<ExternalLawCache?> GetValidAsync(
        string source,
        string queryHash,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        return await _db.ExternalLawCaches
            .FirstOrDefaultAsync(
                x => x.Source == source && x.QueryHash == queryHash && x.ExpiresAt > now,
                ct);
    }

    public async Task UpsertAsync(ExternalLawCache entry, CancellationToken ct = default)
    {
        var existing = await _db.ExternalLawCaches
            .FirstOrDefaultAsync(
                x => x.Source == entry.Source && x.QueryHash == entry.QueryHash,
                ct);

        if (existing is null)
        {
            await _db.ExternalLawCaches.AddAsync(entry, ct);
        }
        else
        {
            existing.QueryText = entry.QueryText;
            existing.ExternalId = entry.ExternalId;
            existing.Title = entry.Title;
            existing.Content = entry.Content;
            existing.SourceUrl = entry.SourceUrl;
            existing.MetadataJson = entry.MetadataJson;
            existing.FetchedAt = entry.FetchedAt;
            existing.ExpiresAt = entry.ExpiresAt;
            existing.HitCount = entry.HitCount;
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
    }

    public async Task<int> ClearAsync(string? queryText = null, CancellationToken ct = default)
    {
        var query = _db.ExternalLawCaches.AsQueryable();

        if (!string.IsNullOrWhiteSpace(queryText))
            query = query.Where(x => x.QueryText == queryText);

        var items = await query.ToListAsync(ct);
        if (items.Count == 0)
            return 0;

        _db.ExternalLawCaches.RemoveRange(items);
        await _db.SaveChangesAsync(ct);
        return items.Count;
    }
}
