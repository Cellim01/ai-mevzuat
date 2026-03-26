using System.Text;
using System.Text.Json;

namespace AiMevzuat.Infrastructure.Services.Mevzuat;

public partial class MevzuatMcpClient
{
    private async Task<string?> InitializeMcpSessionAsync(CancellationToken ct)
    {
        var payload = new
        {
            jsonrpc = "2.0",
            id = $"init-{Guid.NewGuid():N}",
            method = "initialize",
            @params = new
            {
                protocolVersion = "2025-03-26",
                capabilities = new { },
                clientInfo = new
                {
                    name = "ai-mevzuat-backend",
                    version = "1.0.0"
                }
            }
        };

        var (body, sessionId) = await PostMcpJsonRpcAsync(payload, sessionId: null, ct);
        if (string.IsNullOrWhiteSpace(body))
            return null;

        using var initDoc = TryParseJson(body!);
        if (initDoc is not null
            && initDoc.RootElement.ValueKind == JsonValueKind.Object
            && initDoc.RootElement.TryGetProperty("error", out _))
            return null;

        if (!string.IsNullOrWhiteSpace(sessionId))
        {
            var notification = new
            {
                jsonrpc = "2.0",
                method = "notifications/initialized",
                @params = new { }
            };
            await PostMcpJsonRpcAsync(notification, sessionId, ct);
        }

        return sessionId;
    }

    private async Task<string?> CallMcpToolAsync(
        string? sessionId,
        string toolName,
        Dictionary<string, object?> args,
        CancellationToken ct)
    {
        var payload = new
        {
            jsonrpc = "2.0",
            id = $"tool-{Guid.NewGuid():N}",
            method = "tools/call",
            @params = new
            {
                name = toolName,
                arguments = args
            }
        };

        var (body, _) = await PostMcpJsonRpcAsync(payload, sessionId, ct);
        if (string.IsNullOrWhiteSpace(body))
            return null;

        return ExtractToolText(body!);
    }

    private async Task<(string? Body, string? SessionId)> PostMcpJsonRpcAsync(
        object payload,
        string? sessionId,
        CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, string.Empty)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                "application/json")
        };

        if (!string.IsNullOrWhiteSpace(sessionId))
            req.Headers.TryAddWithoutValidation("Mcp-Session-Id", sessionId);

        using var res = await _http.SendAsync(req, ct);
        var responseBody = await res.Content.ReadAsStringAsync(ct);
        var newSessionId = GetMcpSessionId(res);

        if (!res.IsSuccessStatusCode)
        {
            var compactBody = string.IsNullOrWhiteSpace(responseBody)
                ? string.Empty
                : (responseBody.Length <= 600 ? responseBody : responseBody[..600]);
            _logger.LogDebug(
                "MCP json-rpc call failed. Status={Status} Body={Body}",
                (int)res.StatusCode,
                compactBody);
            return (null, newSessionId);
        }

        return (responseBody, newSessionId);
    }

    private static string? ExtractToolText(string rawResponse)
    {
        var direct = TryExtractFromJson(rawResponse);
        if (!string.IsNullOrWhiteSpace(direct))
            return direct;

        var sseLines = rawResponse
            .Split('\n')
            .Where(x => x.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            .Select(x => x[5..].Trim())
            .Where(x => !string.IsNullOrWhiteSpace(x) && x != "[DONE]");

        var parts = new List<string>();
        foreach (var line in sseLines)
        {
            var part = TryExtractFromJson(line);
            if (!string.IsNullOrWhiteSpace(part))
                parts.Add(part.Trim());
        }

        if (parts.Count > 0)
            return string.Join("\n", parts);

        return rawResponse.Trim();
    }

    private static string? TryExtractFromJson(string raw)
    {
        using var doc = TryParseJson(raw);
        if (doc is null)
            return null;

        var root = doc.RootElement;

        if (root.TryGetProperty("error", out _))
            return null;

        if (root.TryGetProperty("result", out var result))
            return ExtractFromRpcResult(result);

        return ExtractFromRpcResult(root);
    }

    private static string? ExtractFromRpcResult(JsonElement elem)
    {
        if (elem.ValueKind == JsonValueKind.String)
            return elem.GetString();

        if (elem.ValueKind != JsonValueKind.Object)
            return null;

        if (elem.TryGetProperty("content", out var content)
            && content.ValueKind == JsonValueKind.Array)
        {
            var texts = new List<string>();
            foreach (var item in content.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.Object
                    && item.TryGetProperty("text", out var textNode)
                    && textNode.ValueKind == JsonValueKind.String)
                {
                    var t = textNode.GetString();
                    if (!string.IsNullOrWhiteSpace(t))
                        texts.Add(t.Trim());
                }
            }

            if (texts.Count > 0)
                return string.Join("\n", texts);
        }

        if (elem.TryGetProperty("text", out var directText)
            && directText.ValueKind == JsonValueKind.String)
            return directText.GetString();

        return null;
    }

    private static JsonDocument? TryParseJson(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        try
        {
            return JsonDocument.Parse(raw);
        }
        catch
        {
            return null;
        }
    }

    private static string? GetMcpSessionId(HttpResponseMessage response)
    {
        if (response.Headers.TryGetValues("Mcp-Session-Id", out var values))
            return values.FirstOrDefault();

        if (response.Headers.TryGetValues("mcp-session-id", out values))
            return values.FirstOrDefault();

        return null;
    }
}
