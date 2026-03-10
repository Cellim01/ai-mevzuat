using System.Security.Claims;
using AiMevzuat.Application.Common.Interfaces;
using Microsoft.AspNetCore.Http;

namespace AiMevzuat.Infrastructure.Identity;

public class PasswordService : IPasswordService
{
    public string Hash(string password)
        => BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);

    public bool Verify(string password, string hash)
        => BCrypt.Net.BCrypt.Verify(password, hash);
}

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _http;

    public CurrentUserService(IHttpContextAccessor http)
    {
        _http = http;
    }

    public Guid? UserId
    {
        get
        {
            var val = _http.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier)
                   ?? _http.HttpContext?.User?.FindFirstValue("sub");
            return Guid.TryParse(val, out var id) ? id : null;
        }
    }

    public string? Email
        => _http.HttpContext?.User?.FindFirstValue(ClaimTypes.Email);

    public bool IsAuthenticated
        => _http.HttpContext?.User?.Identity?.IsAuthenticated ?? false;
}
