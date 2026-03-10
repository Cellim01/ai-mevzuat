using AiMevzuat.Application.DTOs;
using AiMevzuat.Application.Features.Gazette;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace AiMevzuat.API.Controllers;

/// <summary>AI servisinden gelen scrape verisini MSSQL'e kaydeder.</summary>
[ApiController]
[Route("api/gazette")]
public class GazetteIngestController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IConfiguration _config;

    public GazetteIngestController(IMediator mediator, IConfiguration config)
    {
        _mediator = mediator;
        _config   = config;
    }

    /// <summary>POST /api/gazette/ingest — Sadece AI servisi çağırır. X-Api-Key header gerekli.</summary>
    [HttpPost("ingest")]
    public async Task<ActionResult<IngestGazetteResponse>> Ingest(
        [FromBody] IngestGazetteRequest req,
        [FromHeader(Name = "X-Api-Key")] string? apiKey,
        CancellationToken ct)
    {
        var expectedKey = _config["AiService:ApiKey"];
        if (!string.IsNullOrEmpty(expectedKey) && apiKey != expectedKey)
            return Unauthorized(new { message = "Geçersiz API key." });

        if (req.Documents == null || req.Documents.Count == 0)
            return BadRequest(new { message = "Belge listesi boş." });

        try
        {
            var result = await _mediator.Send(new IngestGazetteCommand(req), ct);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
