using AiMevzuat.Application.DTOs;
using AiMevzuat.Domain.Enums;
using MediatR;

namespace AiMevzuat.Application.Features.Gazette;

// ── Query ─────────────────────────────────────────────────────────────────────
public record GetGazettesQuery(
    int Page = 1,
    int PageSize = 20,
    DocumentCategory? Category = null,
    DateOnly? From = null,
    DateOnly? To = null,
    string? Search = null
) : IRequest<PagedResult<GazetteDocumentDto>>;

// ── Handler ──────────────────────────────────────────────────────────────────
public class GetGazettesQueryHandler
    : IRequestHandler<GetGazettesQuery, PagedResult<GazetteDocumentDto>>
{
    private readonly IGazetteRepository _gazette;

    public GetGazettesQueryHandler(IGazetteRepository gazette)
    {
        _gazette = gazette;
    }

    public async Task<PagedResult<GazetteDocumentDto>> Handle(
        GetGazettesQuery q, CancellationToken ct)
    {
        var (items, total) = await _gazette.GetDocumentsPagedAsync(
            q.Page, q.PageSize, q.Category, q.From, q.To, q.Search, ct);

        var dtos = items.Select(d => new GazetteDocumentDto(
            d.Id,
            d.Title,
            d.Summary,
            d.StartPage,
            d.EndPage,
            d.Category.ToString(),
            d.GazetteIssueId,
            d.Issue.IssueNumber,
            d.Issue.PublishedDate
        ));

        return new PagedResult<GazetteDocumentDto>(dtos, total, q.Page, q.PageSize);
    }
}
