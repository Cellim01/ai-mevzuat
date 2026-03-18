using AiMevzuat.Application.Common.Interfaces;
using AiMevzuat.Application.DTOs;
using MediatR;

namespace AiMevzuat.Application.Features.Gazette;

// ── GetById ───────────────────────────────────────────────────────────────────
public record GetGazetteByIdQuery(Guid Id) : IRequest<GazetteDocumentDto?>;

public class GetGazetteByIdHandler : IRequestHandler<GetGazetteByIdQuery, GazetteDocumentDto?>
{
    private readonly IGazetteRepository _repo;

    public GetGazetteByIdHandler(IGazetteRepository repo) => _repo = repo;

    public async Task<GazetteDocumentDto?> Handle(GetGazetteByIdQuery q, CancellationToken ct)
    {
        var doc = await _repo.GetByIdWithIssueAsync(q.Id, ct);
        if (doc is null) return null;

        return new GazetteDocumentDto(
            Id:            doc.Id,
            Title:         doc.Title,
            Summary:       doc.Summary,
            Category:      doc.Category.ToString(),
            SourceType:    doc.SourceType.ToString(),
            StartPage:     doc.StartPage,
            EndPage:       doc.EndPage,
            HtmlUrl:       doc.HtmlUrl,
            PdfUrl:        doc.PdfUrl,
            TableDetected: doc.TableDetected,
            IsVectorized:  doc.IsVectorized,
            IssueId:       doc.GazetteIssueId,
            IssueNumber:   doc.Issue.IssueNumber,
            PublishedDate: doc.Issue.PublishedDate.ToString("yyyy-MM-dd"),
            MainPdfUrl:    doc.Issue.MainPdfUrl);
    }
}

// ── TriggerScrape ─────────────────────────────────────────────────────────────
public record TriggerScrapeCommand(DateOnly Date) : IRequest;

public class TriggerScrapeCommandHandler : IRequestHandler<TriggerScrapeCommand>
{
    private readonly IAiServiceClient _aiClient;

    public TriggerScrapeCommandHandler(IAiServiceClient aiClient) => _aiClient = aiClient;

    public async Task Handle(TriggerScrapeCommand cmd, CancellationToken ct)
        => await _aiClient.TriggerScrapeAsync(cmd.Date, ct);
}
