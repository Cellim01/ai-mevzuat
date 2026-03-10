using AiMevzuat.Domain.Common;

namespace AiMevzuat.Domain.Entities;

/// <summary>
/// Resmi Gazete sayısı — her gün yayımlanan tek bir sayı
/// </summary>
public class GazetteIssue : BaseEntity
{
    public int IssueNumber { get; set; }          // Sayı numarası (örn: 32681)
    public DateOnly PublishedDate { get; set; }   // Yayım tarihi
    public string PdfUrl { get; set; } = string.Empty;
    public string? LocalPdfPath { get; set; }     // İndirildikten sonra yerel yol
    public int TotalPages { get; set; }
    public bool IsProcessed { get; set; } = false; // AI servisi işledi mi?
    public DateTime? ProcessedAt { get; set; }

    // Navigation
    public ICollection<GazetteDocument> Documents { get; set; } = new List<GazetteDocument>();
}
