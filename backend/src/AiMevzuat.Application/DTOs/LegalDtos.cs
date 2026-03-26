namespace AiMevzuat.Application.DTOs;

public record LegalQueryResponse(
    string Query,
    bool UsedExternalFallback,
    bool FromCache,
    string Message,
    List<LegalSourceDto> Sources
);

public record LegalSourceDto(
    string Provider,
    string Title,
    string? Url,
    string Snippet
);
