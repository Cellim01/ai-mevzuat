using AiMevzuat.Domain.Common;
using AiMevzuat.Domain.Enums;

namespace AiMevzuat.Domain.Entities;

/// <summary>
/// Bir Resmi Gazete sayısı içindeki tek bir düzenleme/belge
/// </summary>
public class GazetteDocument : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string? Summary { get; set; }           // AI tarafından üretilen özet
    public string RawText { get; set; } = string.Empty;
    public int StartPage { get; set; }
    public int EndPage { get; set; }
    public DocumentCategory Category { get; set; } = DocumentCategory.Diger;
    public string? MilvusVectorId { get; set; }   // Milvus'taki vektör referansı
    public bool IsVectorized { get; set; } = false;

    // FK
    public Guid GazetteIssueId { get; set; }
    public GazetteIssue Issue { get; set; } = null!;

    // Navigation
    public ICollection<DocumentChange> Changes { get; set; } = new List<DocumentChange>();
}
