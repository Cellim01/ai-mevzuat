namespace AiMevzuat.Application.DTOs;

/// <summary>
/// AI servisinden (/scrape/raw) gelen ingest isteği.
/// _raw_rows_to_scrape_result() çıktısıyla birebir eşleşir.
/// </summary>
public record IngestGazetteRequest(
    int?   IssueNumber,
    string PublishedDate,
    List<IngestDocumentDto> Documents
);

public record IngestDocumentDto(
    int    Index,
    string Title,
    string RawText,
    string? EmbeddingText,

    // Kaynak
    string? HtmlUrl,
    string? PdfUrl,
    string? LocalFilePath,    // local_file alanı
    string  SourceType,       // "html" | "pdf"

    // Sınıflandırma
    string Category,
    int    StartPage,
    int    EndPage,

    // OCR meta
    bool   TableDetected
);

public record IngestGazetteResponse(
    Guid   IssueId,
    int    SavedDocuments,
    int    SkippedDocuments,
    string Message
);
