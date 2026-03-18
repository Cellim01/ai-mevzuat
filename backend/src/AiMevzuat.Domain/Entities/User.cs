using AiMevzuat.Domain.Common;
using AiMevzuat.Domain.Enums;

namespace AiMevzuat.Domain.Entities;

public class User : BaseEntity
{
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Free;
    public bool IsActive { get; set; } = true;
    public bool EmailVerified { get; set; } = false;

    // Navigation
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<UserSubscription> Subscriptions { get; set; } = new List<UserSubscription>();
    public ICollection<UserKeyword> Keywords { get; set; } = new List<UserKeyword>();
}
