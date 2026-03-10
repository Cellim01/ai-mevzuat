using AiMevzuat.Application.DTOs;
using AiMevzuat.Domain.Entities;
using AiMevzuat.Domain.Enums;
using MediatR;

namespace AiMevzuat.Application.Features.Gazette;

public record IngestGazetteCommand(IngestGazetteRequest Request) : IRequest<IngestGazetteResponse>;

public class IngestGazetteCommandHandler
    : IRequestHandler<IngestGazetteCommand, IngestGazetteResponse>
{
    private readonly IGazetteIssueRepository _issueRepo;
    private readonly IGazetteRepository _docRepo;

    public IngestGazetteCommandHandler(
        IGazetteIssueRepository issueRepo,
        IGazetteRepository docRepo)
    {
        _issueRepo = issueRepo;
        _docRepo   = docRepo;
    }

    public async Task<IngestGazetteResponse> Handle(
        IngestGazetteCommand cmd, CancellationToken ct)
    {
        var req = cmd.Request;

        if (!DateOnly.TryParse(req.PublishedDate, out var publishedDate))
            throw new ArgumentException($"Geçersiz tarih formatı: {req.PublishedDate}");

        // Aynı tarihte sayı zaten var mı?
        var existing = await _issueRepo.GetByDateAsync(publishedDate, ct);
        if (existing != null)
            return new IngestGazetteResponse(
                existing.Id, 0, req.Documents.Count,
                $"{publishedDate} tarihli sayı zaten mevcut (Sayı: {existing.IssueNumber}).");

        // GazetteIssue oluştur
        var issue = new GazetteIssue
        {
            IssueNumber   = req.IssueNumber ?? 0,
            PublishedDate = publishedDate,
            PdfUrl        = req.Documents.FirstOrDefault()?.PdfUrl ?? string.Empty,
            TotalPages    = 0,
            IsProcessed   = false,
        };

        await _issueRepo.AddAsync(issue, ct);
        await _issueRepo.SaveChangesAsync(ct);

        // Belgeleri kaydet
        int saved = 0, skipped = 0;

        foreach (var dto in req.Documents)
        {
            if (string.IsNullOrWhiteSpace(dto.Title) || dto.Title == "Başlıksız Belge")
            {
                skipped++;
                continue;
            }

            if (!Enum.TryParse<DocumentCategory>(dto.Category, out var category))
                category = DocumentCategory.Diger;

            var doc = new GazetteDocument
            {
                Title          = dto.Title.Trim(),
                RawText        = dto.RawText,
                StartPage      = dto.Index,
                EndPage        = dto.Index,
                Category       = category,
                GazetteIssueId = issue.Id,
                IsVectorized   = false,
            };

            await _docRepo.AddAsync(doc, ct);
            saved++;
        }

        await _docRepo.SaveChangesAsync(ct);

        issue.IsProcessed = true;
        issue.ProcessedAt = DateTime.UtcNow;
        _issueRepo.Update(issue);
        await _issueRepo.SaveChangesAsync(ct);

        return new IngestGazetteResponse(
            issue.Id, saved, skipped,
            $"Sayı {issue.IssueNumber} kaydedildi: {saved} belge eklendi, {skipped} atlandı.");
    }
}
