using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using AiMevzuat.Application.Common.Interfaces;
using AiMevzuat.Application.DTOs;
using AiMevzuat.Application.Features.Gazette;
using AiMevzuat.Domain.Entities;
using MediatR;

namespace AiMevzuat.Application.Features.Legal;

public record QueryLegalCommand(
    string Query,
    int MaxResults = 5
) : IRequest<LegalQueryResponse>;

public class QueryLegalCommandHandler : IRequestHandler<QueryLegalCommand, LegalQueryResponse>
{
    private readonly IGazetteRepository _gazetteRepository;
    private readonly IExternalLawCacheRepository _cacheRepository;
    private readonly IExternalLawClient _externalLawClient;

    public QueryLegalCommandHandler(
        IGazetteRepository gazetteRepository,
        IExternalLawCacheRepository cacheRepository,
        IExternalLawClient externalLawClient)
    {
        _gazetteRepository = gazetteRepository;
        _cacheRepository = cacheRepository;
        _externalLawClient = externalLawClient;
    }

    public async Task<LegalQueryResponse> Handle(QueryLegalCommand cmd, CancellationToken ct)
    {
        var query = (cmd.Query ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(query))
        {
            return new LegalQueryResponse(
                Query: query,
                UsedExternalFallback: false,
                FromCache: false,
                Message: "Sorgu bos olamaz.",
                Sources: new List<LegalSourceDto>());
        }

        var maxResults = Math.Clamp(cmd.MaxResults, 1, 20);

        var (localItems, _) = await _gazetteRepository.GetDocumentsPagedAsync(
            page: 1,
            pageSize: maxResults,
            category: null,
            from: null,
            to: null,
            search: query,
            ct: ct);

        var localList = localItems.ToList();
        if (localList.Count > 0)
        {
            var localSources = localList.Select(d => new LegalSourceDto(
                Provider: "local_rg",
                Title: d.Title,
                Url: d.HtmlUrl ?? d.PdfUrl,
                Snippet: BuildSnippet(d.RawText)
            )).ToList();

            return new LegalQueryResponse(
                Query: query,
                UsedExternalFallback: false,
                FromCache: false,
                Message: $"{localSources.Count} sonuc local RG verisinden bulundu.",
                Sources: localSources);
        }

        var source = "mevzuat_mcp";
        var queryHash = ComputeQueryHash(query);
        var useCache = maxResults <= 1;
        var cached = useCache
            ? await _cacheRepository.GetValidAsync(source, queryHash, ct)
            : null;
        if (cached is not null)
        {
            cached.HitCount += 1;
            await _cacheRepository.UpsertAsync(cached, ct);

            return new LegalQueryResponse(
                Query: query,
                UsedExternalFallback: true,
                FromCache: true,
                Message: "Sonuc external cache kaydindan getirildi.",
                Sources: new List<LegalSourceDto>
                {
                    new(
                        Provider: source,
                        Title: cached.Title,
                        Url: cached.SourceUrl,
                        Snippet: BuildSnippet(cached.Content))
                });
        }

        var externalResults = await _externalLawClient.QueryAsync(query, maxResults, ct);
        if (externalResults.Count == 0)
        {
            return new LegalQueryResponse(
                Query: query,
                UsedExternalFallback: true,
                FromCache: false,
                Message: "Local ve external kaynaklarda sonuc bulunamadi.",
                Sources: new List<LegalSourceDto>());
        }

        var best = externalResults[0];
        var now = DateTime.UtcNow;
        var entry = new ExternalLawCache
        {
            Source = best.Source,
            QueryHash = queryHash,
            QueryText = query,
            ExternalId = best.ExternalId,
            Title = best.Title,
            Content = best.Content,
            SourceUrl = best.SourceUrl,
            MetadataJson = best.MetadataJson,
            FetchedAt = now,
            ExpiresAt = now.AddDays(7),
            HitCount = 1,
        };
        await _cacheRepository.UpsertAsync(entry, ct);

        var externalSources = externalResults
            .Take(maxResults)
            .Select(x => new LegalSourceDto(
                Provider: x.Source,
                Title: x.Title,
                Url: x.SourceUrl,
                Snippet: BuildSnippet(x.Content)))
            .ToList();

        return new LegalQueryResponse(
            Query: query,
            UsedExternalFallback: true,
            FromCache: false,
            Message: $"{externalSources.Count} sonuc external kaynaktan getirildi (ilk sonuc cachelendi).",
            Sources: externalSources);
    }

    private static string ComputeQueryHash(string query)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(query.ToLowerInvariant()));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string BuildSnippet(string? text)
    {
        var normalized = Regex.Replace(text ?? string.Empty, @"\s+", " ").Trim();
        if (normalized.Length <= 420) return normalized;
        return normalized[..420] + "...";
    }
}
