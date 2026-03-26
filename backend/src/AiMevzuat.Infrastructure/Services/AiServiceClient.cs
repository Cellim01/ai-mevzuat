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

    public async Task TriggerScrapeAsync(DateOnly date, CancellationToken ct = default)
    {
        var payload = JsonSerializer.Serialize(new
        {
            date = date.ToString("yyyy-MM-dd"),
            save_to_backend = true,
        });
        var content = new StringContent(payload, System.Text.Encoding.UTF8, "application/json");
        var res = await _http.PostAsync("/scrape/raw", content, ct);
        res.EnsureSuccessStatusCode();
    }
}
