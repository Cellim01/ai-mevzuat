using AiMevzuat.Application.Common.Interfaces;
using AiMevzuat.Application.DTOs;
using AiMevzuat.Domain.Entities;
using AiMevzuat.Domain.Common;
using MediatR;

namespace AiMevzuat.Application.Features.Auth;

// ── Command ──────────────────────────────────────────────────────────────────
public record RegisterCommand(string FullName, string Email, string Password)
    : IRequest<AuthResponse>;

// ── Handler ──────────────────────────────────────────────────────────────────
public class RegisterCommandHandler : IRequestHandler<RegisterCommand, AuthResponse>
{
    private readonly IRepository<User> _users;
    private readonly IRepository<RefreshToken> _tokens;
    private readonly IPasswordService _pwd;
    private readonly IJwtService _jwt;

    public RegisterCommandHandler(
        IRepository<User> users,
        IRepository<RefreshToken> tokens,
        IPasswordService pwd,
        IJwtService jwt)
    {
        _users = users;
        _tokens = tokens;
        _pwd = pwd;
        _jwt = jwt;
    }

    public async Task<AuthResponse> Handle(RegisterCommand cmd, CancellationToken ct)
    {
        // E-posta tekrar kontrolü yapılabilir (infrastructure'da)
        var user = new User
        {
            FullName = cmd.FullName,
            Email = cmd.Email.ToLowerInvariant(),
            PasswordHash = _pwd.Hash(cmd.Password)
        };

        await _users.AddAsync(user, ct);

        var accessToken = _jwt.GenerateAccessToken(user);
        var refreshTokenValue = _jwt.GenerateRefreshToken();

        var refreshToken = new RefreshToken
        {
            Token = refreshTokenValue,
            UserId = user.Id,
            ExpiresAt = DateTime.UtcNow.AddDays(30)
        };

        await _tokens.AddAsync(refreshToken, ct);
        await _users.SaveChangesAsync(ct);

        return new AuthResponse(
            accessToken,
            refreshTokenValue,
            DateTime.UtcNow.AddMinutes(60),
            new UserDto(user.Id, user.FullName, user.Email, user.Role.ToString())
        );
    }
}
