using AiMevzuat.Application.Common.Interfaces;
using AiMevzuat.Application.Features.Admin;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiMevzuat.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly IMediator _mediator;

    public AdminController(IMediator mediator) => _mediator = mediator;

    [HttpGet("ai/health")]
    public async Task<IActionResult> GetAiHealth(CancellationToken ct)
        => await Proxy(() => _mediator.Send(new GetAiHealthQuery(), ct));

    [HttpGet("jobs")]
    public async Task<IActionResult> ListJobs(CancellationToken ct)
        => await Proxy(() => _mediator.Send(new ListAiJobsQuery(), ct));

    [HttpGet("jobs/{jobId}")]
    public async Task<IActionResult> GetJobStatus(string jobId, CancellationToken ct)
        => await Proxy(() => _mediator.Send(new GetAiJobStatusQuery(jobId), ct));

    [HttpPost("scrape/raw")]
    public async Task<IActionResult> ScrapeRaw([FromBody] AdminRawScrapeRequest req, CancellationToken ct)
    {
        var options = new RawScrapeOptions(
            MaxDocs: req.MaxDocs,
            IncludeMainPdf: req.IncludeMainPdf,
            KeepDebugImages: req.KeepDebugImages,
            AllowTablePages: req.AllowTablePages,
            SaveToBackend: req.SaveToBackend,
            OnlyUrls: req.OnlyUrls,
            PreviewLimit: req.PreviewLimit
        );

        return await Proxy(() => _mediator.Send(new TriggerRawScrapeCommand(req.Date, options), ct));
    }

    [HttpGet("scrape/raw/output/{targetDate}")]
    public async Task<IActionResult> GetRawOutput(DateOnly targetDate, [FromQuery] int limit = 20, CancellationToken ct = default)
        => await Proxy(() => _mediator.Send(new GetRawOutputQuery(targetDate, limit), ct));

    [HttpDelete("legal/cache")]
    public async Task<IActionResult> ClearLegalCache([FromQuery] string? query = null, CancellationToken ct = default)
    {
        var result = await _mediator.Send(new ClearExternalLawCacheCommand(query), ct);
        return Ok(result);
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
    DateOnly Date,
    int MaxDocs = 0,
    bool IncludeMainPdf = false,
    bool KeepDebugImages = false,
    bool AllowTablePages = false,
    bool SaveToBackend = true,
    List<string>? OnlyUrls = null,
    int PreviewLimit = 20
);
