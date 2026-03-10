using AiMevzuat.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
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

    public async Task<string?> GetDocumentSummaryAsync(string text, CancellationToken ct = default)
    {
        var payload = JsonSerializer.Serialize(new { text });
        var content = new StringContent(payload, System.Text.Encoding.UTF8, "application/json");
        var res = await _http.PostAsync("/summarize", content, ct);
        if (!res.IsSuccessStatusCode) return null;
        var json = await res.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.GetProperty("summary").GetString();
    }

    public async Task TriggerScrapeAsync(DateOnly date, CancellationToken ct = default)
    {
        var payload = JsonSerializer.Serialize(new { date = date.ToString("yyyy-MM-dd") });
        var content = new StringContent(payload, System.Text.Encoding.UTF8, "application/json");
        await _http.PostAsync("/scrape", content, ct);
    }
}
