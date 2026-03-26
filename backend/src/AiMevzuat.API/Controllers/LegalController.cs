using AiMevzuat.Application.DTOs;
using AiMevzuat.Application.Features.Legal;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiMevzuat.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LegalController : ControllerBase
{
    private readonly IMediator _mediator;

    public LegalController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost("query")]
    public async Task<ActionResult<LegalQueryResponse>> Query(
        [FromBody] LegalQueryRequest req,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Query))
            return BadRequest(new { message = "query zorunlu." });

        var result = await _mediator.Send(
            new QueryLegalCommand(req.Query, req.MaxResults),
            ct);

        return Ok(result);
    }
}

public record LegalQueryRequest(string Query, int MaxResults = 5);
