using AiMevzuat.Application.Common.Interfaces;
using System.Text;
using System.Text.Json;

namespace AiMevzuat.Infrastructure.Services.Mevzuat;

public partial class MevzuatMcpClient
{
    private async Task<IReadOnlyList<ExternalLawResult>> TryDirectBedestenFallbackAsync(
        string query,
        int maxResults,
        CancellationToken ct)
    {
        var empty = Array.Empty<ExternalLawResult>();
        try
        {
            var phrasePayload = new
            {
                data = new
                {
                    pageSize = maxResults,
                    pageNumber = 1,
                    sortFields = new[] { "RESMI_GAZETE_TARIHI" },
                    sortDirection = "desc",
                    phrase = query,
                    basliktaAra = false
                },
                applicationName = "UyapMevzuat",
                paging = true
            };

            var (phraseHits, phrasePreview) = await TrySearchBedestenHitsAsync(phrasePayload, maxResults, ct);
            var allHits = new List<BedestenSearchHit>(phraseHits);
            var mergedSearchPreview = phrasePreview ?? string.Empty;

            if (allHits.Count < maxResults)
            {
                var titlePayload = new
                {
                    data = new
                    {
                        pageSize = maxResults,
                        pageNumber = 1,
                        sortFields = new[] { "RESMI_GAZETE_TARIHI" },
                        sortDirection = "desc",
                        mevzuatAdi = query,
                        basliktaAra = true
                    },
                    applicationName = "UyapMevzuat",
                    paging = true
                };

                var (titleHits, titlePreview) = await TrySearchBedestenHitsAsync(titlePayload, maxResults, ct);
                if (!string.IsNullOrWhiteSpace(titlePreview))
                    mergedSearchPreview = string.IsNullOrWhiteSpace(mergedSearchPreview)
                        ? titlePreview
                        : $"{mergedSearchPreview}\n{titlePreview}";

                foreach (var hit in titleHits)
                {
                    if (allHits.Any(x => string.Equals(x.MevzuatId, hit.MevzuatId, StringComparison.OrdinalIgnoreCase)))
                        continue;
                    allHits.Add(hit);
                    if (allHits.Count >= maxResults)
                        break;
                }
            }

            if (allHits.Count == 0)
                return empty;

            var results = new List<ExternalLawResult>();
            foreach (var hit in allHits.Take(maxResults))
            {
                var item = await BuildResultFromBedestenHitAsync(hit, query, mergedSearchPreview, ct);
                if (item is not null)
                    results.Add(item);
            }

            return results.Count == 0 ? empty : results;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Direct bedesten fallback failed for query '{Query}'.", query);
            return empty;
        }
    }

    private async Task<(List<BedestenSearchHit> Hits, string? SearchPreview)> TrySearchBedestenHitsAsync(
        object payload,
        int maxResults,
        CancellationToken ct)
    {
        using var searchReq = BuildBedestenRequest($"{BedestenBaseUrl}/searchDocuments", payload);
        using var searchRes = await _http.SendAsync(searchReq, ct);
        if (!searchRes.IsSuccessStatusCode)
            return (new List<BedestenSearchHit>(), null);

        var searchRaw = await searchRes.Content.ReadAsStringAsync(ct);
        using var searchDoc = TryParseJson(searchRaw);
        if (searchDoc is null)
            return (new List<BedestenSearchHit>(), null);

        var searchRoot = searchDoc.RootElement;
        if (!IsBedestenSuccess(searchRoot))
            return (new List<BedestenSearchHit>(), null);

        if (!searchRoot.TryGetProperty("data", out var searchData))
            return (new List<BedestenSearchHit>(), null);

        if (!searchData.TryGetProperty("mevzuatList", out var mevzuatList))
            return (new List<BedestenSearchHit>(), null);

        if (mevzuatList.ValueKind != JsonValueKind.Array || mevzuatList.GetArrayLength() == 0)
            return (new List<BedestenSearchHit>(), null);

        var hits = new List<BedestenSearchHit>();
        foreach (var item in mevzuatList.EnumerateArray())
        {
            var mevzuatId = TryGetString(item, "mevzuatId");
            if (string.IsNullOrWhiteSpace(mevzuatId))
                continue;

            var title = TryGetString(item, "mevzuatAdi");
            var mevzuatNo = TryGetString(item, "mevzuatNo");
            var rg = TryGetString(item, "resmiGazeteTarihi");
            var url = TryGetString(item, "url");

            if (hits.All(x => !string.Equals(x.MevzuatId, mevzuatId, StringComparison.OrdinalIgnoreCase)))
                hits.Add(new BedestenSearchHit(mevzuatId, title, mevzuatNo, rg, url));

            if (hits.Count >= maxResults)
                break;
        }

        var preview = hits.Count == 0
            ? null
            : string.Join("\n", hits.Select(BuildBedestenSearchLine));

        return (hits, preview);
    }

    private async Task<ExternalLawResult?> BuildResultFromBedestenHitAsync(
        BedestenSearchHit hit,
        string query,
        string? searchTextPreview,
        CancellationToken ct)
    {
        var mevzuatId = hit.MevzuatId;
        var title = hit.Title ?? query;
        var mevzuatNo = hit.MevzuatNo;
        var rgTarihi = hit.RgTarihi;
        var sourceUrl = BuildSourceUrl(mevzuatId, mevzuatNo, hit.SourceUrl);

        var contentPayload = new
        {
            data = new
            {
                documentType = "MEVZUAT",
                id = mevzuatId
            },
            applicationName = "UyapMevzuat"
        };

        using var contentReq = BuildBedestenRequest($"{BedestenBaseUrl}/getDocumentContent", contentPayload);
        using var contentRes = await _http.SendAsync(contentReq, ct);
        if (!contentRes.IsSuccessStatusCode)
            return null;

        var contentRaw = await contentRes.Content.ReadAsStringAsync(ct);
        using var contentDoc = TryParseJson(contentRaw);
        if (contentDoc is null)
            return null;

        var contentRoot = contentDoc.RootElement;
        if (!IsBedestenSuccess(contentRoot))
            return null;

        if (!contentRoot.TryGetProperty("data", out var contentData))
            return null;

        var mimeType = TryGetString(contentData, "mimeType");
        if (!string.IsNullOrWhiteSpace(mimeType)
            && mimeType.Contains("pdf", StringComparison.OrdinalIgnoreCase))
        {
            var line = BuildBedestenSearchLine(hit);
            var preview = IsSearchResultTextUseful(searchTextPreview)
                ? NormalizePlainText(searchTextPreview ?? string.Empty)
                : null;
            var text = !string.IsNullOrWhiteSpace(preview) ? $"{line}\n{preview}" : line;
            text = NormalizePlainText(text);

            var metadataPdfOnly = JsonSerializer.Serialize(new
            {
                fetch = "bedesten_search_only_pdf",
                mevzuatNo,
                resmiGazeteTarihi = rgTarihi
            });

            return new ExternalLawResult(
                Source: "mevzuat_mcp",
                ExternalId: mevzuatId,
                Title: title,
                Content: text,
                SourceUrl: sourceUrl,
                MetadataJson: metadataPdfOnly);
        }

        var encodedContent = TryGetString(contentData, "content");
        var decodedContent = DecodeBase64Safely(encodedContent);
        if (string.IsNullOrWhiteSpace(decodedContent))
            return null;

        var plain = NormalizePlainText(StripHtml(decodedContent));
        if (!IsUsefulText(plain))
        {
            var line = BuildBedestenSearchLine(hit);
            var preview = IsSearchResultTextUseful(searchTextPreview)
                ? NormalizePlainText(searchTextPreview ?? string.Empty)
                : null;
            plain = !string.IsNullOrWhiteSpace(preview) ? $"{line}\n{preview}" : line;
            plain = NormalizePlainText(plain);
        }

        var metadata = JsonSerializer.Serialize(new
        {
            fetch = "bedesten_fallback",
            mevzuatNo,
            resmiGazeteTarihi = rgTarihi
        });

        return new ExternalLawResult(
            Source: "mevzuat_mcp",
            ExternalId: mevzuatId,
            Title: title,
            Content: plain,
            SourceUrl: sourceUrl,
            MetadataJson: metadata);
    }

    private static HttpRequestMessage BuildBedestenRequest(string url, object payload)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                "application/json")
        };

        req.Headers.TryAddWithoutValidation("AdaletApplicationName", "UyapMevzuat");
        req.Headers.TryAddWithoutValidation("Origin", "https://mevzuat.adalet.gov.tr");
        req.Headers.TryAddWithoutValidation("Referer", "https://mevzuat.adalet.gov.tr/");
        req.Headers.TryAddWithoutValidation(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");

        return req;
    }

    private static string BuildBedestenSearchLine(BedestenSearchHit hit)
    {
        var no = string.IsNullOrWhiteSpace(hit.MevzuatNo) ? string.Empty : $"[{hit.MevzuatNo}] ";
        var rg = string.IsNullOrWhiteSpace(hit.RgTarihi) ? string.Empty : $" | RG: {hit.RgTarihi}";
        return $"{no}{(hit.Title ?? "Mevzuat")} | mevzuatId: {hit.MevzuatId}{rg}";
    }
}
