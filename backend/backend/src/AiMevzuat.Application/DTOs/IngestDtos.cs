namespace AiMevzuat.Application.DTOs;

/// <summary>AI servisinden gelen scrape sonucu</summary>
public record IngestGazetteRequest(
    int? IssueNumber,
    string PublishedDate,
    List<IngestDocumentDto> Documents
);

public record IngestDocumentDto(
    int Index,
    string Title,
    string RawText,
    string HtmlUrl,
    string PdfUrl,
    string? LocalPdfPath,
    string Category
);

public record IngestGazetteResponse(
    Guid IssueId,
    int SavedDocuments,
    int SkippedDocuments,
    string Message
);
