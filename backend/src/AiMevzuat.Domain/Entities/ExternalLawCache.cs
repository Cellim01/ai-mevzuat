using AiMevzuat.Domain.Common;

namespace AiMevzuat.Domain.Entities;

public class ExternalLawCache : BaseEntity
{
    public string Source { get; set; } = "mevzuat_mcp";
    public string QueryHash { get; set; } = string.Empty;
    public string QueryText { get; set; } = string.Empty;

    public string ExternalId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? SourceUrl { get; set; }
    public string? MetadataJson { get; set; }

    public DateTime FetchedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(7);
    public int HitCount { get; set; } = 0;
}
