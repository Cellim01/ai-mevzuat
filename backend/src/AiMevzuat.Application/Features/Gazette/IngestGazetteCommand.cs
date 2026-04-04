using AiMevzuat.Application.DTOs;
using AiMevzuat.Domain.Entities;
using AiMevzuat.Domain.Enums;
using MediatR;
using System.Text.RegularExpressions;

namespace AiMevzuat.Application.Features.Gazette;

public record IngestGazetteCommand(IngestGazetteRequest Request) : IRequest<IngestGazetteResponse>;

public class IngestGazetteCommandHandler
    : IRequestHandler<IngestGazetteCommand, IngestGazetteResponse>
{
    private static readonly Regex PageMarkerRegex = new(
        @"\[PAGE\s+\d+\]",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex MultiWhitespaceRegex = new(
        @"\s+",
        RegexOptions.Compiled);

    private readonly IGazetteIssueRepository _issueRepo;
    private readonly IGazetteRepository      _docRepo;

    public IngestGazetteCommandHandler(
        IGazetteIssueRepository issueRepo,
        IGazetteRepository      docRepo)
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

        // İlk PDF belgeden ana PDF URL'i çıkar
        var firstPdf = req.Documents.FirstOrDefault(d =>
            string.Equals(d.SourceType, "pdf", StringComparison.OrdinalIgnoreCase));

        // GazetteIssue oluştur
        var issue = new GazetteIssue
        {
            IssueNumber    = req.IssueNumber ?? 0,
            PublishedDate  = publishedDate,
            MainPdfUrl     = firstPdf?.PdfUrl,
            TotalDocuments = req.Documents.Count,
            IsProcessed    = false,
        };

        await _issueRepo.AddAsync(issue, ct);
        await _issueRepo.SaveChangesAsync(ct);

        int saved = 0, skipped = 0;

        foreach (var dto in req.Documents)
        {
            // Başlıksız veya çok kısa metinli belgeleri atla
            if (string.IsNullOrWhiteSpace(dto.Title) || dto.Title == "Başlıksız Belge")
            {
                skipped++;
                continue;
            }
            if (dto.RawText.Length < 50)
            {
                skipped++;
                continue;
            }

            var normalizedCategory = NormalizeCategory(dto.Category);
            if (!Enum.TryParse<DocumentCategory>(normalizedCategory, ignoreCase: true, out var category))
                category = DocumentCategory.Diger;

            if (!Enum.TryParse<SourceType>(dto.SourceType, ignoreCase: true, out var sourceType))
                sourceType = SourceType.Pdf;

            var doc = new GazetteDocument
            {
                Title          = dto.Title.Trim(),
                RawText        = dto.RawText,
                SearchText     = BuildSearchText(dto),
                StartPage      = dto.StartPage,
                EndPage        = dto.EndPage,
                Category       = category,
                SourceType     = sourceType,
                HtmlUrl        = string.IsNullOrWhiteSpace(dto.HtmlUrl)      ? null : dto.HtmlUrl,
                PdfUrl         = string.IsNullOrWhiteSpace(dto.PdfUrl)       ? null : dto.PdfUrl,
                LocalFilePath  = string.IsNullOrWhiteSpace(dto.LocalFilePath)? null : dto.LocalFilePath,
                TableDetected  = dto.TableDetected,
                GazetteIssueId = issue.Id,
                IsVectorized   = false,
                RgSection      = string.IsNullOrWhiteSpace(dto.RgSection)    ? null : dto.RgSection.Trim(),
                RgSubSection   = string.IsNullOrWhiteSpace(dto.RgSubSection) ? null : dto.RgSubSection.Trim(),
            };

            await _docRepo.AddAsync(doc, ct);
            saved++;
        }

        await _docRepo.SaveChangesAsync(ct);

        issue.IsProcessed    = true;
        issue.ProcessedAt    = DateTime.UtcNow;
        issue.TotalDocuments = saved;
        _issueRepo.Update(issue);
        await _issueRepo.SaveChangesAsync(ct);

        return new IngestGazetteResponse(
            issue.Id, saved, skipped,
            $"Sayı {issue.IssueNumber} kaydedildi: {saved} belge eklendi, {skipped} atlandı.");
    }

    private static string BuildSearchText(IngestDocumentDto dto)
    {
        var mainText = !string.IsNullOrWhiteSpace(dto.EmbeddingText)
            ? dto.EmbeddingText!
            : dto.RawText;

        var normalizedTitle = NormalizeForSearch(dto.Title);
        var normalizedBody = NormalizeForSearch(mainText);

        if (string.IsNullOrWhiteSpace(normalizedBody))
            normalizedBody = NormalizeForSearch(dto.RawText);

        if (string.IsNullOrWhiteSpace(normalizedBody))
            normalizedBody = dto.RawText.Trim();

        if (string.IsNullOrWhiteSpace(normalizedTitle))
            return normalizedBody;

        return $"{normalizedTitle}\n\n{normalizedBody}";
    }

    private static string NormalizeForSearch(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var text = value.Replace('\0', ' ');
        text = PageMarkerRegex.Replace(text, " ");
        text = MultiWhitespaceRegex.Replace(text, " ");
        return text.Trim();
    }

    private static string NormalizeCategory(string? category)
    {
        if (string.IsNullOrWhiteSpace(category))
            return string.Empty;

        var trimmed = category.Trim();

        // Legacy ai-service kategorisi. Enum'da yoksa Diger'e dusuyordu.
        if (trimmed.Equals("YargiCeza", StringComparison.OrdinalIgnoreCase))
            return "YargiKarari";

        return trimmed;
    }
}
