using AiMevzuat.API.Filters;
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

    public GazetteIngestController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>POST /api/gazette/ingest - Sadece AI servisi cagirir. X-Api-Key header gerekli.</summary>
    [HttpPost("ingest")]
    [ServiceFilter(typeof(AiServiceApiKeyFilter))]
    public async Task<ActionResult<IngestGazetteResponse>> Ingest(
        [FromBody] IngestGazetteRequest req,
        CancellationToken ct)
    {
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
