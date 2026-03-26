using AiMevzuat.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace AiMevzuat.Infrastructure.Services.Mevzuat;

public partial class MevzuatMcpClient : IExternalLawClient
{
    private const string DefaultMcpUrl = "https://mevzuat.surucu.dev/mcp";
    private const string BedestenBaseUrl = "https://bedesten.adalet.gov.tr/mevzuat";
    private const string MevzuatGovBaseUrl = "https://www.mevzuat.gov.tr";
    private const string MevzuatAdaletBaseUrl = "https://mevzuat.adalet.gov.tr";

    private readonly HttpClient _http;
    private readonly ILogger<MevzuatMcpClient> _logger;
    private readonly bool _enabled;
    private readonly bool _useDirectBedestenFallback;

    private sealed record BedestenSearchHit(
        string MevzuatId,
        string? Title,
        string? MevzuatNo,
        string? RgTarihi,
        string? SourceUrl);

    private sealed record McpSearchHit(
        string MevzuatId,
        string Title,
        string? MevzuatNo,
        string? RgTarihi,
        string? GerekceId);

    public MevzuatMcpClient(
        HttpClient http,
        IConfiguration config,
        ILogger<MevzuatMcpClient> logger)
    {
        _http = http;
        _logger = logger;

        var rawBaseUrl = config["MevzuatMcp:BaseUrl"] ?? DefaultMcpUrl;
        var normalizedBaseUrl = NormalizeMcpBaseUrl(rawBaseUrl);
        if (Uri.TryCreate(normalizedBaseUrl, UriKind.Absolute, out var baseUri))
            _http.BaseAddress = baseUri;

        var timeoutSeconds = ParseInt(config["MevzuatMcp:TimeoutSeconds"], 30, 5, 180);
        _http.Timeout = TimeSpan.FromSeconds(timeoutSeconds);

        _enabled = ParseBool(config["MevzuatMcp:Enabled"], defaultValue: true);
        _useDirectBedestenFallback = ParseBool(
            config["MevzuatMcp:UseDirectBedestenFallback"],
            defaultValue: true);
    }

    public async Task<IReadOnlyList<ExternalLawResult>> QueryAsync(
        string query,
        int maxResults = 5,
        CancellationToken ct = default)
    {
        var empty = Array.Empty<ExternalLawResult>();
        var q = (query ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(q))
            return empty;
        var effectiveMaxResults = Math.Clamp(maxResults, 1, 20);

        if (!_enabled)
        {
            _logger.LogInformation("Mevzuat MCP client disabled by config.");
            return empty;
        }

        try
        {
            var sessionId = await InitializeMcpSessionAsync(ct);

            var phraseSearchText = await CallMcpToolAsync(
                sessionId,
                "search_mevzuat",
                new Dictionary<string, object?>
                {
                    ["phrase"] = q,
                    ["basliktaAra"] = false,
                    ["page"] = 1,
                    ["page_size"] = effectiveMaxResults,
                },
                ct);

            var mergedSearchText = phraseSearchText ?? string.Empty;
            var hits = ParseSearchHits(phraseSearchText, q, effectiveMaxResults);

            if (hits.Count < effectiveMaxResults)
            {
                var titleSearchText = await CallMcpToolAsync(
                    sessionId,
                    "search_mevzuat",
                    new Dictionary<string, object?>
                    {
                        ["mevzuat_adi"] = q,
                        ["basliktaAra"] = true,
                        ["page"] = 1,
                        ["page_size"] = effectiveMaxResults,
                    },
                    ct);

                if (!string.IsNullOrWhiteSpace(titleSearchText))
                {
                    mergedSearchText = string.IsNullOrWhiteSpace(mergedSearchText)
                        ? titleSearchText
                        : $"{mergedSearchText}\n{titleSearchText}";

                    var titleHits = ParseSearchHits(titleSearchText, q, effectiveMaxResults);
                    foreach (var hit in titleHits)
                    {
                        if (hits.Any(x => string.Equals(x.MevzuatId, hit.MevzuatId, StringComparison.OrdinalIgnoreCase)))
                            continue;
                        hits.Add(hit);
                        if (hits.Count >= effectiveMaxResults)
                            break;
                    }
                }
            }

            if (!LooksLikeNoResult(mergedSearchText))
            {
                if (hits.Count > 0)
                {
                    var results = new List<ExternalLawResult>(hits.Count);
                    foreach (var hit in hits)
                    {
                        var result = await BuildResultForHitAsync(
                            sessionId,
                            hit,
                            q,
                            effectiveMaxResults,
                            mergedSearchText,
                            ct);
                        if (result is not null)
                            results.Add(result);
                    }

                    if (results.Count > 0)
                        return results;
                }

                if (IsSearchResultTextUseful(mergedSearchText))
                {
                    var metadata = JsonSerializer.Serialize(new
                    {
                        fetch = "mcp_search_unparsed"
                    });

                    return new[]
                    {
                        new ExternalLawResult(
                            Source: "mevzuat_mcp",
                            ExternalId: $"search::{ComputeStableId(q)}",
                            Title: q,
                            Content: NormalizePlainText(mergedSearchText),
                            SourceUrl: BuildSearchUrl(q),
                            MetadataJson: metadata)
                    };
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "MCP tool call failed for query '{Query}'.", q);
        }

        if (!_useDirectBedestenFallback)
            return empty;

        return await TryDirectBedestenFallbackAsync(q, effectiveMaxResults, ct);
    }

    private async Task<ExternalLawResult?> BuildResultForHitAsync(
        string? sessionId,
        McpSearchHit hit,
        string query,
        int maxResults,
        string? searchText,
        CancellationToken ct)
    {
        var contentText = await CallMcpToolAsync(
            sessionId,
            "get_mevzuat_content",
            new Dictionary<string, object?>
            {
                ["mevzuat_id"] = hit.MevzuatId
            },
            ct);

        var normalizedContent = NormalizePlainText(contentText ?? string.Empty);
        if (!IsUsefulText(normalizedContent))
        {
            var withinText = await CallMcpToolAsync(
                sessionId,
                "search_within_mevzuat",
                new Dictionary<string, object?>
                {
                    ["mevzuat_id"] = hit.MevzuatId,
                    ["keyword"] = query,
                    ["max_results"] = Math.Clamp(maxResults, 1, 50)
                },
                ct);

            normalizedContent = NormalizePlainText(withinText ?? string.Empty);
        }

        var gerekceText = await GetGerekceTextAsync(sessionId, hit.GerekceId, ct);
        var maddeTreeText = await GetMaddeTreeTextAsync(sessionId, hit.MevzuatId, ct);

        var combined = CombineSections(
            normalizedContent,
            gerekceText,
            maddeTreeText,
            IsSearchResultTextUseful(searchText)
                ? NormalizePlainText(searchText ?? string.Empty)
                : null);

        if (!IsUsefulText(combined) && !IsSearchResultTextUseful(combined))
            return null;

        var metadata = JsonSerializer.Serialize(new
        {
            fetch = "mcp_tool_call",
            mevzuatNo = hit.MevzuatNo,
            rgTarihi = hit.RgTarihi,
            gerekceId = hit.GerekceId,
            gerekceFetched = IsUsefulText(gerekceText),
            maddeTreeFetched = IsUsefulText(maddeTreeText),
        });

        return new ExternalLawResult(
            Source: "mevzuat_mcp",
            ExternalId: hit.MevzuatId,
            Title: hit.Title,
            Content: combined,
            SourceUrl: BuildSourceUrl(hit.MevzuatId, hit.MevzuatNo, null),
            MetadataJson: metadata);
    }
}
