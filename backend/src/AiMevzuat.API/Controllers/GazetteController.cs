using AiMevzuat.Application.DTOs;
using AiMevzuat.Application.Features.Gazette;
using AiMevzuat.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiMevzuat.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GazetteController : ControllerBase
{
    private readonly IMediator _mediator;

    public GazetteController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<GazetteDocumentDto>>> GetDocuments(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] DocumentCategory? category = null,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(
            new GetGazettesQuery(page, pageSize, category, from, to, search), ct);
        return Ok(result);
    }

    [HttpGet("issues")]
    public async Task<ActionResult<PagedResult<GazetteIssueDto>>> GetIssues(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(new GetGazetteIssuesQuery(page, pageSize, from, to), ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<GazetteDocumentDto>> GetById(Guid id, CancellationToken ct)
    {
        var result = await _mediator.Send(new GetGazetteByIdQuery(id), ct);
        if (result is null) return NotFound();
        return Ok(result);
    }

    [HttpPost("scrape")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> TriggerScrape([FromQuery] DateOnly? date = null, CancellationToken ct = default)
    {
        await _mediator.Send(new TriggerScrapeCommand(date ?? DateOnly.FromDateTime(DateTime.Today)), ct);
        return Accepted(new { message = "Scrape islemi baslatildi." });
    }
}
