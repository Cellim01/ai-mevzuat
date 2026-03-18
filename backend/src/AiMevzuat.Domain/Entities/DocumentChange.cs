using AiMevzuat.Domain.Common;

namespace AiMevzuat.Domain.Entities;

/// <summary>
/// Bir belgenin önceki versiyonuyla farkı (Diff-Checker)
/// </summary>
public class DocumentChange : BaseEntity
{
    public string OldText { get; set; } = string.Empty;
    public string NewText { get; set; } = string.Empty;
    public string? AiExplanation { get; set; }    // AI'ın sade dil açıklaması
    public string? DiffJson { get; set; }         // Satır bazlı diff JSON

    // FK
    public Guid DocumentId { get; set; }
    public GazetteDocument Document { get; set; } = null!;

    public Guid? PreviousDocumentId { get; set; } // Değiştirilen önceki belge
}
