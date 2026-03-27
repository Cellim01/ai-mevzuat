using AiMevzuat.Application.Common.Interfaces;
using AiMevzuat.Application.Features.Legal;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiMevzuat.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly IAiServiceClient _aiServiceClient;
    private readonly IExternalLawCacheRepository _externalLawCacheRepository;

    public AdminController(
        IAiServiceClient aiServiceClient,
        IExternalLawCacheRepository externalLawCacheRepository)
    {
        _aiServiceClient = aiServiceClient;
        _externalLawCacheRepository = externalLawCacheRepository;
    }

    [HttpGet("ai/health")]
    public async Task<IActionResult> GetAiHealth(CancellationToken ct)
        => await Proxy(async () => await _aiServiceClient.GetHealthAsync(ct));

    [HttpGet("jobs")]
    public async Task<IActionResult> ListJobs(CancellationToken ct)
        => await Proxy(async () => await _aiServiceClient.ListJobsAsync(ct));

    [HttpGet("jobs/{jobId}")]
    public async Task<IActionResult> GetJobStatus(string jobId, CancellationToken ct)
        => await Proxy(async () => await _aiServiceClient.GetJobStatusAsync(jobId, ct));

    [HttpPost("scrape/raw")]
    public async Task<IActionResult> ScrapeRaw([FromBody] AdminRawScrapeRequest req, CancellationToken ct)
    {
        if (!DateOnly.TryParse(req.Date, out var date))
            return BadRequest(new { message = "Gecersiz tarih formati. YYYY-MM-DD bekleniyor." });

        var options = new RawScrapeOptions(
            MaxDocs: req.MaxDocs,
            IncludeMainPdf: req.IncludeMainPdf,
            KeepDebugImages: req.KeepDebugImages,
            AllowTablePages: req.AllowTablePages,
            SaveToBackend: req.SaveToBackend,
            OnlyUrls: req.OnlyUrls,
            PreviewLimit: req.PreviewLimit
        );

        return await Proxy(async () => await _aiServiceClient.ScrapeRawAsync(date, options, ct));
    }

    [HttpGet("scrape/raw/output/{targetDate}")]
    public async Task<IActionResult> GetRawOutput(string targetDate, [FromQuery] int limit = 20, CancellationToken ct = default)
    {
        if (!DateOnly.TryParse(targetDate, out var date))
            return BadRequest(new { message = "Gecersiz tarih formati. YYYY-MM-DD bekleniyor." });

        return await Proxy(async () => await _aiServiceClient.GetRawOutputAsync(date, limit, ct));
    }

    [HttpDelete("legal/cache")]
    public async Task<IActionResult> ClearLegalCache([FromQuery] string? query = null, CancellationToken ct = default)
    {
        var deleted = await _externalLawCacheRepository.ClearAsync(query, ct);
        return Ok(new
        {
            deleted,
            query = query ?? string.Empty,
            message = deleted == 0 ? "Silinecek cache kaydi bulunamadi." : $"{deleted} cache kaydi silindi."
        });
    }

    private async Task<IActionResult> Proxy(Func<Task<string?>> call)
    {
        try
        {
            var raw = await call();
            if (string.IsNullOrWhiteSpace(raw))
                return StatusCode(502, new { message = "AI servisinden bos yanit alindi." });

            return Content(raw, "application/json");
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(502, new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}

public record AdminRawScrapeRequest(
    string Date,
    int MaxDocs = 0,
    bool IncludeMainPdf = false,
    bool KeepDebugImages = false,
    bool AllowTablePages = false,
    bool SaveToBackend = true,
    List<string>? OnlyUrls = null,
    int PreviewLimit = 20
);
