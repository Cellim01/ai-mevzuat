using AiMevzuat.Domain.Common;
using AiMevzuat.Domain.Enums;

namespace AiMevzuat.Domain.Entities;

public class UserSubscription : BaseEntity
{
    public DocumentCategory Category { get; set; }
    public bool NotifyEmail { get; set; } = true;
    public bool NotifyPush { get; set; } = false;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
}

public class UserKeyword : BaseEntity
{
    public string Keyword { get; set; } = string.Empty;
    public bool NotifyEmail { get; set; } = true;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
}
