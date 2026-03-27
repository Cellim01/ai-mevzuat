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
