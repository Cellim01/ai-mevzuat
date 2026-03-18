namespace AiMevzuat.Application.DTOs;

public record GazetteDocumentDto(
    Guid     Id,
    string   Title,
    string?  Summary,
    string   Category,
    string   SourceType,
    int      StartPage,
    int      EndPage,
    string?  HtmlUrl,
    string?  PdfUrl,
    bool     TableDetected,
    bool     IsVectorized,
    // Issue bilgileri
    Guid     IssueId,
    int      IssueNumber,
    string   PublishedDate,
    string?  MainPdfUrl
);

public record GazetteDocumentDetailDto(
    Guid     Id,
    string   Title,
    string?  Summary,
    string   RawText,
    string   Category,
    string   SourceType,
    int      StartPage,
    int      EndPage,
    string?  HtmlUrl,
    string?  PdfUrl,
    bool     TableDetected,
    bool     IsVectorized,
    Guid     IssueId,
    int      IssueNumber,
    string   PublishedDate,
    string?  MainPdfUrl
);

public record GazetteIssueDto(
    Guid     Id,
    int      IssueNumber,
    string   PublishedDate,
    int      DocumentCount,
    bool     IsProcessed,
    string?  MainPdfUrl,
    string?  IndexUrl
);

public record GazetteListResponse(
    List<GazetteDocumentDto> Documents,
    int TotalCount,
    int Page,
    int PageSize
);
