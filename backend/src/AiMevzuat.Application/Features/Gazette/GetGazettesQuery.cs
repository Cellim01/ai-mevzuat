using AiMevzuat.Application.DTOs;
using AiMevzuat.Domain.Enums;
using MediatR;

namespace AiMevzuat.Application.Features.Gazette;

// ── PagedResult ───────────────────────────────────────────────────────────────
public record PagedResult<T>(
    IEnumerable<T> Items,
    int TotalCount,
    int Page,
    int PageSize
);

// ── Query ─────────────────────────────────────────────────────────────────────
public record GetGazettesQuery(
    int Page = 1,
    int PageSize = 20,
    DocumentCategory? Category = null,
    DateOnly? From = null,
    DateOnly? To = null,
    string? Search = null
) : IRequest<PagedResult<GazetteDocumentDto>>;

// ── Handler ───────────────────────────────────────────────────────────────────
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
            Id:            d.Id,
            Title:         d.Title,
            Summary:       d.Summary,
            Category:      d.Category.ToString(),
            SourceType:    d.SourceType.ToString(),
            StartPage:     d.StartPage,
            EndPage:       d.EndPage,
            HtmlUrl:       d.HtmlUrl,
            PdfUrl:        d.PdfUrl,
            TableDetected: d.TableDetected,
            IsVectorized:  d.IsVectorized,
            IssueId:       d.GazetteIssueId,
            IssueNumber:   d.Issue.IssueNumber,
            PublishedDate: d.Issue.PublishedDate.ToString("yyyy-MM-dd"),
            MainPdfUrl:    d.Issue.MainPdfUrl,
            RgSection:     d.RgSection,
            RgSubSection:  d.RgSubSection
        ));

        return new PagedResult<GazetteDocumentDto>(dtos, total, q.Page, q.PageSize);
    }
}

public record GetGazetteIssuesQuery(
    int Page = 1,
    int PageSize = 20,
    DateOnly? From = null,
    DateOnly? To = null
) : IRequest<PagedResult<GazetteIssueDto>>;

public class GetGazetteIssuesQueryHandler
    : IRequestHandler<GetGazetteIssuesQuery, PagedResult<GazetteIssueDto>>
{
    private readonly IGazetteIssueRepository _issues;

    public GetGazetteIssuesQueryHandler(IGazetteIssueRepository issues)
    {
        _issues = issues;
    }

    public async Task<PagedResult<GazetteIssueDto>> Handle(
        GetGazetteIssuesQuery q, CancellationToken ct)
    {
        var (items, total) = await _issues.GetIssuesPagedAsync(
            q.Page, q.PageSize, q.From, q.To, ct);

        var dtos = items.Select(i => new GazetteIssueDto(
            Id: i.Id,
            IssueNumber: i.IssueNumber,
            PublishedDate: i.PublishedDate.ToString("yyyy-MM-dd"),
            DocumentCount: i.TotalDocuments,
            IsProcessed: i.IsProcessed,
            MainPdfUrl: i.MainPdfUrl,
            IndexUrl: i.IndexUrl
        ));

        return new PagedResult<GazetteIssueDto>(dtos, total, q.Page, q.PageSize);
    }
}
