using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Linq;
using AiMevzuat.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AiMevzuat.Infrastructure.Services.Groq;

public class GroqLlamaAnswerClient : ILegalAnswerClient
{
    private readonly HttpClient _http;
    private readonly ILogger<GroqLlamaAnswerClient> _logger;
    private readonly bool _enabled;
    private readonly string _apiKey;
    private readonly string _model;
    private readonly string? _fallbackModel;
    private readonly double _temperature;
    private readonly int _maxTokens;
    private string? _lastUsedModel;

    public string? ActiveModel => _lastUsedModel
        ?? (_enabled && !string.IsNullOrWhiteSpace(_apiKey) ? _model : null);

    public GroqLlamaAnswerClient(
        HttpClient http,
        IConfiguration config,
        ILogger<GroqLlamaAnswerClient> logger)
    {
        _http = http;
        _logger = logger;

        var baseUrl = (config["GroqLlm:BaseUrl"] ?? "https://api.groq.com/openai/v1").Trim();
        if (!baseUrl.EndsWith("/"))
            baseUrl += "/";
        _http.BaseAddress = new Uri(baseUrl);
        _http.Timeout = TimeSpan.FromSeconds(ParseInt(config["GroqLlm:TimeoutSeconds"], 45, 5, 180));

        _enabled = ParseBool(config["GroqLlm:Enabled"], false);
        _apiKey = (config["GroqLlm:ApiKey"] ?? string.Empty).Trim();
        _model = (config["GroqLlm:Model"] ?? "llama-3.3-70b-versatile").Trim();
        _fallbackModel = NormalizeOptionalModel(config["GroqLlm:FallbackModel"] ?? "llama-3.1-8b-instant");
        _temperature = ParseDouble(config["GroqLlm:Temperature"], 0.2, 0, 1.5);
        _maxTokens = ParseInt(config["GroqLlm:MaxTokens"], 700, 100, 4000);
    }

    public async Task<string?> GenerateAnswerAsync(
        string query,
        IReadOnlyList<LegalContextItem> context,
        CancellationToken ct = default)
    {
        if (!_enabled || string.IsNullOrWhiteSpace(_apiKey) || context.Count == 0)
            return null;

        try
        {
            var prompt = BuildUserPrompt(query, context);

            var primary = await SendCompletionAsync(_model, prompt, ct);
            if (primary.answer is not null)
            {
                _lastUsedModel = _model;
                return primary.answer;
            }

            if (ShouldFallback(primary.statusCode, primary.errorBody) && !string.IsNullOrWhiteSpace(_fallbackModel))
            {
                var fallbackModel = _fallbackModel!;
                _logger.LogInformation(
                    "Groq limit/rate nedeniyle fallback devrede. Primary={Primary} Fallback={Fallback}",
                    _model,
                    fallbackModel);

                var fallback = await SendCompletionAsync(fallbackModel, prompt, ct);
                if (fallback.answer is not null)
                {
                    _lastUsedModel = fallbackModel;
                    return fallback.answer;
                }
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Groq cevap uretiminde hata.");
            return null;
        }
    }

    private async Task<(string? answer, HttpStatusCode? statusCode, string errorBody)> SendCompletionAsync(
        string model,
        string prompt,
        CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "chat/completions");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);

        var payload = new
        {
            model,
            temperature = _temperature,
            max_tokens = _maxTokens,
            messages = new object[]
            {
                new
                {
                    role = "system",
                    content = "Sen resmi kaynaklara dayali bir hukuk asistanisin. Sadece verilen kaynaklardan cevap ver. Emin degilsen acikca belirt. Halisinasyon uretme."
                },
                new
                {
                    role = "user",
                    content = prompt
                }
            }
        };

        req.Content = new StringContent(
            JsonSerializer.Serialize(payload),
            Encoding.UTF8,
            "application/json");

        var resp = await _http.SendAsync(req, ct);
        if (!resp.IsSuccessStatusCode)
        {
            var err = await SafeReadAsync(resp, ct);
            _logger.LogWarning(
                "Groq cevap uretimi basarisiz. Model={Model} Status={Status} Body={Body}",
                model,
                (int)resp.StatusCode,
                err);
            return (null, resp.StatusCode, err);
        }

        await using var stream = await resp.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        if (!doc.RootElement.TryGetProperty("choices", out var choices) ||
            choices.ValueKind != JsonValueKind.Array ||
            choices.GetArrayLength() == 0)
            return (null, resp.StatusCode, string.Empty);

        var first = choices[0];
        if (!first.TryGetProperty("message", out var message) ||
            !message.TryGetProperty("content", out var contentEl))
            return (null, resp.StatusCode, string.Empty);

        var answer = (contentEl.GetString() ?? string.Empty).Trim();
        return string.IsNullOrWhiteSpace(answer)
            ? (null, resp.StatusCode, string.Empty)
            : (answer, resp.StatusCode, string.Empty);
    }

    private static string BuildUserPrompt(string query, IReadOnlyList<LegalContextItem> context)
    {
        var sb = new StringBuilder();
        sb.AppendLine("SORU:");
        sb.AppendLine(query.Trim());
        sb.AppendLine();
        sb.AppendLine("KAYNAKLAR:");

        var take = context.Take(8).ToList();
        for (var i = 0; i < take.Count; i++)
        {
            var item = take[i];
            sb.AppendLine($"[{i + 1}] {item.Title}");
            if (!string.IsNullOrWhiteSpace(item.Url))
                sb.AppendLine($"URL: {item.Url}");
            sb.AppendLine($"Ozet: {Truncate(item.Snippet, 1000)}");
            sb.AppendLine();
        }

        sb.AppendLine("Talimat:");
        sb.AppendLine("- Cevabi Turkce ver.");
        sb.AppendLine("- Sadece verilen kaynaklara dayan.");
        sb.AppendLine("- Kisa ve net ol.");
        sb.AppendLine("- Sonunda 'Kaynaklar: [..]' formatinda kaynak numaralarini yaz.");
        return sb.ToString().Trim();
    }

    private static string Truncate(string text, int maxLen)
    {
        var value = (text ?? string.Empty).Trim();
        if (value.Length <= maxLen) return value;
        return value[..maxLen] + "...";
    }

    private static bool ParseBool(string? raw, bool defaultValue)
    {
        if (bool.TryParse(raw, out var b))
            return b;
        return defaultValue;
    }

    private static int ParseInt(string? raw, int defaultValue, int min, int max)
    {
        if (!int.TryParse(raw, out var v))
            return defaultValue;
        return Math.Clamp(v, min, max);
    }

    private static double ParseDouble(string? raw, double defaultValue, double min, double max)
    {
        if (!double.TryParse(raw, out var v))
            return defaultValue;
        return Math.Clamp(v, min, max);
    }

    private static async Task<string> SafeReadAsync(HttpResponseMessage resp, CancellationToken ct)
    {
        try { return await resp.Content.ReadAsStringAsync(ct); }
        catch { return string.Empty; }
    }

    private static bool ShouldFallback(HttpStatusCode? statusCode, string? body)
    {
        if (statusCode == HttpStatusCode.TooManyRequests)
            return true;

        var low = (body ?? string.Empty).ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(low))
            return false;

        return low.Contains("rate limit")
               || low.Contains("rate_limit")
               || low.Contains("requests per minute")
               || low.Contains("tokens per minute")
               || low.Contains("rpm")
               || low.Contains("tpm");
    }

    private static string? NormalizeOptionalModel(string? value)
    {
        var trimmed = (value ?? string.Empty).Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }
}
