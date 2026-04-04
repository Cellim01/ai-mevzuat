using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Linq;
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
    private readonly IAiServiceClient _aiServiceClient;
    private readonly IExternalLawCacheRepository _cacheRepository;
    private readonly IExternalLawClient _externalLawClient;
    private readonly ILegalAnswerClient _legalAnswerClient;

    private sealed record LocalCandidate(
        GazetteDocument Document,
        string Snippet,
        bool FromSemantic);

    public QueryLegalCommandHandler(
        IGazetteRepository gazetteRepository,
        IAiServiceClient aiServiceClient,
        IExternalLawCacheRepository cacheRepository,
        IExternalLawClient externalLawClient,
        ILegalAnswerClient legalAnswerClient)
    {
        _gazetteRepository = gazetteRepository;
        _aiServiceClient = aiServiceClient;
        _cacheRepository = cacheRepository;
        _externalLawClient = externalLawClient;
        _legalAnswerClient = legalAnswerClient;
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
        var semanticHits = await TrySemanticSearchAsync(query, maxResults, ct);
        var semanticCandidates = await BuildSemanticCandidatesAsync(semanticHits, ct);

        var (keywordItems, _) = await _gazetteRepository.GetDocumentsPagedAsync(
            page: 1,
            pageSize: maxResults,
            category: null,
            from: null,
            to: null,
            search: query,
            ct: ct);

        var localCandidates = MergeLocalCandidates(
            semanticCandidates,
            keywordItems.ToList(),
            maxResults);

        if (localCandidates.Count > 0)
        {
            var localSources = localCandidates.Select(x => new LegalSourceDto(
                Provider: x.FromSemantic ? "local_rg_semantic" : "local_rg_keyword",
                Title: x.Document.Title,
                Url: x.Document.HtmlUrl ?? x.Document.PdfUrl,
                Snippet: x.Snippet
            )).ToList();
            var answer = await BuildAnswerAsync(query, localSources, ct);
            var semanticCount = localCandidates.Count(x => x.FromSemantic);
            var keywordCount = localCandidates.Count - semanticCount;

            return new LegalQueryResponse(
                Query: query,
                UsedExternalFallback: false,
                FromCache: false,
                Message: $"{localSources.Count} sonuc local RG verisinden bulundu (semantic: {semanticCount}, keyword: {keywordCount}).",
                Sources: localSources,
                Answer: answer,
                AnswerModel: answer is null ? null : _legalAnswerClient.ActiveModel);
        }

        var source = "mevzuat_mcp";
        var queryHash = ComputeQueryHash(query);
        var cached = await _cacheRepository.GetValidAsync(source, queryHash, ct);
        if (cached is not null)
        {
            cached.HitCount += 1;
            await _cacheRepository.UpsertAsync(cached, ct);
            var cachedSources = new List<LegalSourceDto>
            {
                new(
                    Provider: source,
                    Title: cached.Title,
                    Url: cached.SourceUrl,
                    Snippet: BuildSnippet(cached.Content))
            };
            var answer = await BuildAnswerAsync(query, cachedSources, ct);

            return new LegalQueryResponse(
                Query: query,
                UsedExternalFallback: true,
                FromCache: true,
                Message: "Sonuc external cache kaydindan getirildi.",
                Sources: cachedSources,
                Answer: answer,
                AnswerModel: answer is null ? null : _legalAnswerClient.ActiveModel);
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
        var externalAnswer = await BuildAnswerAsync(query, externalSources, ct);

        return new LegalQueryResponse(
            Query: query,
            UsedExternalFallback: true,
            FromCache: false,
            Message: $"{externalSources.Count} sonuc external kaynaktan getirildi (ilk sonuc cachelendi).",
            Sources: externalSources,
            Answer: externalAnswer,
            AnswerModel: externalAnswer is null ? null : _legalAnswerClient.ActiveModel);
    }

    private async Task<IReadOnlyList<VectorSearchHit>> TrySemanticSearchAsync(
        string query,
        int maxResults,
        CancellationToken ct)
    {
        try
        {
            return await _aiServiceClient.QueryVectorAsync(query, maxResults, ct);
        }
        catch
        {
            return Array.Empty<VectorSearchHit>();
        }
    }

    private async Task<List<LocalCandidate>> BuildSemanticCandidatesAsync(
        IReadOnlyList<VectorSearchHit> semanticHits,
        CancellationToken ct)
    {
        if (semanticHits.Count == 0)
            return new List<LocalCandidate>();

        var urls = semanticHits
            .Select(x => (x.SourceUrl ?? string.Empty).Trim())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (urls.Count == 0)
            return new List<LocalCandidate>();

        var docs = await _gazetteRepository.GetBySourceUrlsAsync(urls, ct);
        if (docs.Count == 0)
            return new List<LocalCandidate>();

        var byUrl = new Dictionary<string, GazetteDocument>(StringComparer.OrdinalIgnoreCase);
        foreach (var doc in docs)
        {
            if (!string.IsNullOrWhiteSpace(doc.HtmlUrl) && !byUrl.ContainsKey(doc.HtmlUrl))
                byUrl[doc.HtmlUrl] = doc;
            if (!string.IsNullOrWhiteSpace(doc.PdfUrl) && !byUrl.ContainsKey(doc.PdfUrl))
                byUrl[doc.PdfUrl] = doc;
        }

        var list = new List<LocalCandidate>();
        var seenDocIds = new HashSet<Guid>();
        foreach (var hit in semanticHits)
        {
            var url = (hit.SourceUrl ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(url))
                continue;

            if (!byUrl.TryGetValue(url, out var doc))
                continue;
            if (!seenDocIds.Add(doc.Id))
                continue;

            var snippetBase = !string.IsNullOrWhiteSpace(hit.Snippet)
                ? hit.Snippet
                : (!string.IsNullOrWhiteSpace(doc.SearchText) ? doc.SearchText : doc.RawText);

            list.Add(new LocalCandidate(
                Document: doc,
                Snippet: BuildSnippet(snippetBase),
                FromSemantic: true));
        }

        return list;
    }

    private static List<LocalCandidate> MergeLocalCandidates(
        IReadOnlyList<LocalCandidate> semanticCandidates,
        IReadOnlyList<GazetteDocument> keywordDocs,
        int maxResults)
    {
        var merged = new List<LocalCandidate>();
        var seenDocIds = new HashSet<Guid>();

        foreach (var semantic in semanticCandidates)
        {
            if (!seenDocIds.Add(semantic.Document.Id))
                continue;
            merged.Add(semantic);
            if (merged.Count >= maxResults)
                return merged;
        }

        foreach (var keywordDoc in keywordDocs)
        {
            if (!seenDocIds.Add(keywordDoc.Id))
                continue;

            merged.Add(new LocalCandidate(
                Document: keywordDoc,
                Snippet: BuildSnippet(
                    !string.IsNullOrWhiteSpace(keywordDoc.SearchText)
                        ? keywordDoc.SearchText
                        : keywordDoc.RawText),
                FromSemantic: false));

            if (merged.Count >= maxResults)
                break;
        }

        return merged;
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

    private async Task<string?> BuildAnswerAsync(
        string query,
        IReadOnlyList<LegalSourceDto> sources,
        CancellationToken ct)
    {
        if (sources.Count == 0)
            return null;

        var context = sources
            .Select(s => new LegalContextItem(s.Title, s.Url, s.Snippet))
            .ToList();

        return await _legalAnswerClient.GenerateAnswerAsync(query, context, ct);
    }
}
