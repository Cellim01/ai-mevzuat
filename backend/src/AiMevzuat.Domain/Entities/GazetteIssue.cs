using AiMevzuat.Domain.Common;

namespace AiMevzuat.Domain.Entities;

/// <summary>
/// Resmi Gazete sayısı — her gün yayımlanan tek bir sayı
/// </summary>
public class GazetteIssue : BaseEntity
{
    public int     IssueNumber   { get; set; }   // Sayı no (örn: 33200)
    public DateOnly PublishedDate { get; set; }  // Yayım tarihi

    public string? MainPdfUrl    { get; set; }   // Günlük ana PDF URL'i
    public string? IndexUrl      { get; set; }   // HTML index URL

    public int  TotalDocuments   { get; set; } = 0;
    public bool IsProcessed      { get; set; } = false;
    public DateTime? ProcessedAt { get; set; }

    // Navigation
    public ICollection<GazetteDocument> Documents { get; set; } = new List<GazetteDocument>();
}
