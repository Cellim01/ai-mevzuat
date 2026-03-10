using AiMevzuat.Domain.Enums;

namespace AiMevzuat.Application.DTOs;

public record GazetteIssueDto(
    Guid Id,
    int IssueNumber,
    DateOnly PublishedDate,
    string PdfUrl,
    int TotalPages,
    bool IsProcessed,
    int DocumentCount
);

public record GazetteDocumentDto(
    Guid Id,
    string Title,
    string? Summary,
    int StartPage,
    int EndPage,
    string Category,
    Guid IssueId,
    int IssueNumber,
    DateOnly PublishedDate
);

public record GazetteListRequest(
    int Page = 1,
    int PageSize = 20,
    DocumentCategory? Category = null,
    DateOnly? From = null,
    DateOnly? To = null,
    string? Search = null
);

public record PagedResult<T>(
    IEnumerable<T> Items,
    int Total,
    int Page,
    int PageSize
);
