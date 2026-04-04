using AiMevzuat.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using System.Text;
using System.Text.Json;

namespace AiMevzuat.Infrastructure.Services;

public class AiServiceClient : IAiServiceClient
{
    private readonly HttpClient _http;

    public AiServiceClient(HttpClient http, IConfiguration config)
    {
        _http = http;
        _http.BaseAddress = new Uri(config["AiService:BaseUrl"] ?? "http://localhost:8000");
    }

    public async Task TriggerScrapeAsync(DateOnly date, CancellationToken ct = default)
    {
        var payload = new
        {
            date = date.ToString("yyyy-MM-dd"),
            save_to_backend = true,
        };

        var res = await _http.PostAsync(
            "/scrape/raw",
            BuildJsonContent(payload),
            ct);
        res.EnsureSuccessStatusCode();
    }

    public async Task<string?> GetHealthAsync(CancellationToken ct = default)
        => await GetAsync("/health", ct);

    public async Task<string?> ListJobsAsync(CancellationToken ct = default)
        => await GetAsync("/scrape/jobs", ct);

    public async Task<string?> GetJobStatusAsync(string jobId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(jobId))
            return null;

        return await GetAsync($"/scrape/status/{Uri.EscapeDataString(jobId)}", ct);
    }

    public async Task<string?> ScrapeRawAsync(
        DateOnly date,
        RawScrapeOptions? options = null,
        CancellationToken ct = default)
    {
        var cfg = options ?? new RawScrapeOptions();
        var payload = new
        {
            date = date.ToString("yyyy-MM-dd"),
            max_docs = cfg.MaxDocs,
            include_main_pdf = cfg.IncludeMainPdf,
            keep_debug_images = cfg.KeepDebugImages,
            allow_table_pages = cfg.AllowTablePages,
            save_to_backend = cfg.SaveToBackend,
            only_urls = cfg.OnlyUrls,
            preview_limit = cfg.PreviewLimit,
        };

        return await PostAsync("/scrape/raw", payload, ct);
    }

    public async Task<string?> GetRawOutputAsync(DateOnly date, int limit = 20, CancellationToken ct = default)
    {
        var normalizedLimit = Math.Clamp(limit, 1, 100);
        return await GetAsync($"/scrape/raw/output/{date:yyyy-MM-dd}?limit={normalizedLimit}", ct);
    }

    public async Task<IReadOnlyList<VectorSearchHit>> QueryVectorAsync(
        string query,
        int maxResults = 5,
        CancellationToken ct = default)
    {
        var q = (query ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(q))
            return Array.Empty<VectorSearchHit>();

        var payload = new
        {
            query = q,
            max_results = Math.Clamp(maxResults, 1, 20),
        };

        var body = await PostAsync("/search/vector", payload, ct);
        if (string.IsNullOrWhiteSpace(body))
            return Array.Empty<VectorSearchHit>();

        try
        {
            using var doc = JsonDocument.Parse(body);
            if (!doc.RootElement.TryGetProperty("hits", out var hitsNode) ||
                hitsNode.ValueKind != JsonValueKind.Array)
            {
                return Array.Empty<VectorSearchHit>();
            }

            var list = new List<VectorSearchHit>();
            foreach (var hit in hitsNode.EnumerateArray())
            {
                var sourceUrl = hit.TryGetProperty("source_url", out var srcNode)
                    ? (srcNode.GetString() ?? string.Empty).Trim()
                    : string.Empty;
                if (string.IsNullOrWhiteSpace(sourceUrl))
                    continue;

                var title = hit.TryGetProperty("title", out var titleNode)
                    ? titleNode.GetString()
                    : null;
                var snippet = hit.TryGetProperty("snippet", out var snippetNode)
                    ? (snippetNode.GetString() ?? string.Empty).Trim()
                    : string.Empty;
                var docId = hit.TryGetProperty("doc_id", out var docNode)
                    ? docNode.GetString()
                    : null;

                double score = 0;
                if (hit.TryGetProperty("score", out var scoreNode))
                {
                    if (scoreNode.ValueKind == JsonValueKind.Number)
                        scoreNode.TryGetDouble(out score);
                    else if (scoreNode.ValueKind == JsonValueKind.String)
                        double.TryParse(scoreNode.GetString(), out score);
                }

                list.Add(new VectorSearchHit(
                    SourceUrl: sourceUrl,
                    Title: title,
                    Snippet: snippet,
                    Score: score,
                    DocId: docId));
            }

            return list;
        }
        catch
        {
            return Array.Empty<VectorSearchHit>();
        }
    }

    private async Task<string?> GetAsync(string path, CancellationToken ct)
    {
        var res = await _http.GetAsync(path, ct);
        var body = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
            throw new HttpRequestException($"AI service GET failed ({(int)res.StatusCode}): {body}");
        return body;
    }

    private async Task<string?> PostAsync(string path, object payload, CancellationToken ct)
    {
        var res = await _http.PostAsync(path, BuildJsonContent(payload), ct);
        var body = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
            throw new HttpRequestException($"AI service POST failed ({(int)res.StatusCode}): {body}");
        return body;
    }

    private static StringContent BuildJsonContent(object payload)
    {
        var json = JsonSerializer.Serialize(payload);
        return new StringContent(json, Encoding.UTF8, "application/json");
    }
}
