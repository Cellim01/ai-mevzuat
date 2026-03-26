using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace AiMevzuat.Infrastructure.Services.Mevzuat;

public partial class MevzuatMcpClient
{
    private static List<McpSearchHit> ParseSearchHits(
        string? text,
        string queryFallback,
        int maxResults)
    {
        var results = new List<McpSearchHit>();
        if (string.IsNullOrWhiteSpace(text))
            return results;

        var lines = text
            .Split('\n')
            .Select(x => x.Trim())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Where(x => Regex.IsMatch(x, @"mevzuatid\s*:", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant));

        foreach (var line in lines)
        {
            var idMatch = Regex.Match(
                line,
                @"mevzuatid\s*:\s*([^\s|]+)",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            if (!idMatch.Success)
                continue;

            var mevzuatId = idMatch.Groups[1].Value.Trim();
            if (string.IsNullOrWhiteSpace(mevzuatId))
                continue;

            var rgMatch = Regex.Match(
                line,
                @"rg\s*:\s*([^|]+)",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            var rgTarihi = rgMatch.Success ? rgMatch.Groups[1].Value.Trim() : null;

            var gerekceMatch = Regex.Match(
                line,
                @"gerekceid\s*:\s*([^\s|]+)",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            var gerekceId = gerekceMatch.Success ? gerekceMatch.Groups[1].Value.Trim() : null;

            var left = line.TrimStart('-').Trim().Split('|')[0].Trim();
            var mevzuatNo = default(string);
            var title = queryFallback;

            var noMatch = Regex.Match(left, @"^\[(?<no>[^\]]+)\]\s*(?<title>.*)$");
            if (noMatch.Success)
            {
                mevzuatNo = noMatch.Groups["no"].Value.Trim();
                var parsedTitle = noMatch.Groups["title"].Value.Trim();
                if (!string.IsNullOrWhiteSpace(parsedTitle))
                    title = parsedTitle;
            }
            else if (!string.IsNullOrWhiteSpace(left))
            {
                title = left;
            }

            if (results.All(x => !string.Equals(x.MevzuatId, mevzuatId, StringComparison.OrdinalIgnoreCase)))
                results.Add(new McpSearchHit(mevzuatId, title, mevzuatNo, rgTarihi, gerekceId));

            if (results.Count >= maxResults)
                break;
        }

        return results;
    }

    private async Task<string?> GetGerekceTextAsync(
        string? sessionId,
        string? gerekceId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(gerekceId))
            return null;

        var firstTry = await CallMcpToolAsync(
            sessionId,
            "get_mevzuat_gerekce",
            new Dictionary<string, object?>
            {
                ["gerekce_id"] = gerekceId
            },
            ct);

        var normalized = NormalizePlainText(firstTry ?? string.Empty);
        if (IsUsefulText(normalized))
            return normalized;

        var secondTry = await CallMcpToolAsync(
            sessionId,
            "get_mevzuat_gerekce",
            new Dictionary<string, object?>
            {
                ["gerekceId"] = gerekceId
            },
            ct);

        normalized = NormalizePlainText(secondTry ?? string.Empty);
        return IsUsefulText(normalized) ? normalized : null;
    }

    private async Task<string?> GetMaddeTreeTextAsync(
        string? sessionId,
        string mevzuatId,
        CancellationToken ct)
    {
        var firstTry = await CallMcpToolAsync(
            sessionId,
            "get_mevzuat_madde_tree",
            new Dictionary<string, object?>
            {
                ["mevzuat_id"] = mevzuatId
            },
            ct);

        var normalized = NormalizePlainText(firstTry ?? string.Empty);
        if (IsUsefulText(normalized))
            return normalized;

        var secondTry = await CallMcpToolAsync(
            sessionId,
            "get_mevzuat_madde_tree",
            new Dictionary<string, object?>
            {
                ["mevzuatId"] = mevzuatId
            },
            ct);

        normalized = NormalizePlainText(secondTry ?? string.Empty);
        return IsUsefulText(normalized) ? normalized : null;
    }

    private static string CombineSections(
        string? mainContent,
        string? gerekceText,
        string? maddeTreeText,
        string? searchFallback)
    {
        var parts = new List<string>();

        if (IsUsefulText(gerekceText))
            parts.Add($"[GEREKCE]\n{NormalizePlainText(gerekceText!)}");

        if (IsUsefulText(maddeTreeText))
            parts.Add($"[MADDE_TREE]\n{NormalizePlainText(maddeTreeText!)}");

        if (IsUsefulText(mainContent))
            parts.Add($"[METIN]\n{NormalizePlainText(mainContent!)}");
        else if (IsSearchResultTextUseful(searchFallback))
            parts.Add($"[SEARCH]\n{NormalizePlainText(searchFallback!)}");

        return NormalizePlainText(string.Join("\n\n", parts));
    }

    private static bool LooksLikeNoResult(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return true;

        var t = text.ToLowerInvariant();
        return t.Contains("no results found")
            || t.Contains("sonuc bulunamadi");
    }

    private static bool IsUsefulText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return false;

        var t = text.Trim();
        if (t.Length < 120)
            return false;

        if (LooksLikeBinaryPdfText(t))
            return false;

        var low = t.ToLowerInvariant();
        return !low.StartsWith("error:")
            && !low.StartsWith("search error:")
            && !low.Contains("an unexpected error occurred")
            && !low.Contains("no results found");
    }

    private static bool IsSearchResultTextUseful(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return false;

        var t = text.Trim();
        if (t.Length < 20)
            return false;

        if (LooksLikeNoResult(t))
            return false;

        return t.Contains("mevzuatId:", StringComparison.OrdinalIgnoreCase)
            || t.Contains("Results:", StringComparison.OrdinalIgnoreCase)
            || t.Contains("[", StringComparison.Ordinal)
            || t.Contains("RG:", StringComparison.OrdinalIgnoreCase)
            || t.Contains("Search:", StringComparison.OrdinalIgnoreCase)
            || t.Contains("Browse", StringComparison.OrdinalIgnoreCase);
    }

    private static bool LooksLikeBinaryPdfText(string text)
    {
        var sample = text.Length > 4000 ? text[..4000] : text;
        var trimmed = sample.TrimStart();
        if (trimmed.StartsWith("%PDF-", StringComparison.OrdinalIgnoreCase))
            return true;

        if (sample.Contains("xref", StringComparison.OrdinalIgnoreCase)
            && sample.Contains("endobj", StringComparison.OrdinalIgnoreCase))
            return true;

        var symbolCount = sample.Count(c =>
            !char.IsLetterOrDigit(c)
            && !char.IsWhiteSpace(c)
            && c is not '.' and not ',' and not ';' and not ':' and not '(' and not ')' and not '-');
        var ratio = sample.Length == 0 ? 0 : (double)symbolCount / sample.Length;
        return ratio > 0.25;
    }

    private static bool IsBedestenSuccess(JsonElement root)
    {
        if (!root.TryGetProperty("metadata", out var metadata))
            return false;

        var fmt = TryGetString(metadata, "FMTY");
        return string.Equals(fmt, "SUCCESS", StringComparison.OrdinalIgnoreCase);
    }

    private static string? TryGetString(JsonElement obj, string propertyName)
    {
        if (obj.ValueKind != JsonValueKind.Object)
            return null;

        if (!obj.TryGetProperty(propertyName, out var value))
            return null;

        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number => value.ToString(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => null
        };
    }

    private static string DecodeBase64Safely(string? maybeBase64)
    {
        if (string.IsNullOrWhiteSpace(maybeBase64))
            return string.Empty;

        try
        {
            var bytes = Convert.FromBase64String(maybeBase64);
            return Encoding.UTF8.GetString(bytes);
        }
        catch
        {
            return maybeBase64;
        }
    }

    private static string StripHtml(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        var withBreaks = Regex.Replace(input, @"<br\s*/?>", "\n", RegexOptions.IgnoreCase);
        var noTags = Regex.Replace(withBreaks, @"<[^>]+>", " ");
        return WebUtility.HtmlDecode(noTags);
    }

    private static string NormalizePlainText(string text)
    {
        var normalized = Regex.Replace(text ?? string.Empty, @"\r\n?", "\n");
        normalized = Regex.Replace(normalized, @"[ \t]+\n", "\n");
        normalized = Regex.Replace(normalized, @"\n{3,}", "\n\n");
        normalized = normalized.Trim();

        if (normalized.Length > 120_000)
            normalized = normalized[..120_000];

        return normalized;
    }

    private static string NormalizeMcpBaseUrl(string value)
    {
        var url = (value ?? string.Empty).Trim().TrimEnd('/');
        if (string.IsNullOrWhiteSpace(url))
            return DefaultMcpUrl;

        if (url.EndsWith("/mcp", StringComparison.OrdinalIgnoreCase))
            return url;

        return $"{url}/mcp";
    }

    private static string BuildSourceUrl(string? mevzuatId, string? mevzuatNo, string? rawUrl)
    {
        if (!string.IsNullOrWhiteSpace(rawUrl))
        {
            var candidate = rawUrl.Trim();
            if (Uri.TryCreate(candidate, UriKind.Absolute, out var abs))
                return abs.ToString();

            if (candidate.StartsWith("/", StringComparison.Ordinal))
                return $"{MevzuatGovBaseUrl}{candidate}";

            return $"{MevzuatGovBaseUrl}/{candidate.TrimStart('/')}";
        }

        if (!string.IsNullOrWhiteSpace(mevzuatId))
            return $"{MevzuatAdaletBaseUrl}/?mevzuatId={Uri.EscapeDataString(mevzuatId)}";

        if (!string.IsNullOrWhiteSpace(mevzuatNo))
            return $"{MevzuatGovBaseUrl}/?q={Uri.EscapeDataString(mevzuatNo)}";

        return MevzuatAdaletBaseUrl;
    }

    private static string BuildSearchUrl(string query)
    {
        if (string.IsNullOrWhiteSpace(query))
            return MevzuatAdaletBaseUrl;

        return $"{MevzuatAdaletBaseUrl}/?q={Uri.EscapeDataString(query)}";
    }

    private static bool ParseBool(string? raw, bool defaultValue)
    {
        if (bool.TryParse(raw, out var b))
            return b;
        return defaultValue;
    }

    private static int ParseInt(string? raw, int defaultValue, int min, int max)
    {
        if (int.TryParse(raw, out var parsed))
            return Math.Clamp(parsed, min, max);
        return defaultValue;
    }

    private static string ComputeStableId(string value)
    {
        using var sha = System.Security.Cryptography.SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(value.ToLowerInvariant()));
        return Convert.ToHexString(bytes).ToLowerInvariant()[..24];
    }
}
