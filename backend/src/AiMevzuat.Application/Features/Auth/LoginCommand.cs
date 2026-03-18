using AiMevzuat.Application.Common.Interfaces;
using AiMevzuat.Application.DTOs;
using AiMevzuat.Application.Features.Gazette;
using AiMevzuat.Domain.Entities;
using AiMevzuat.Domain.Common;
using MediatR;

namespace AiMevzuat.Application.Features.Auth;

// ── Command ──────────────────────────────────────────────────────────────────
public record LoginCommand(string Email, string Password) : IRequest<AuthResponse>;

// ── Handler ──────────────────────────────────────────────────────────────────
public class LoginCommandHandler : IRequestHandler<LoginCommand, AuthResponse>
{
    private readonly IUserRepository _users;
    private readonly IRepository<RefreshToken> _tokens;
    private readonly IPasswordService _pwd;
    private readonly IJwtService _jwt;

    public LoginCommandHandler(
        IUserRepository users,
        IRepository<RefreshToken> tokens,
        IPasswordService pwd,
        IJwtService jwt)
    {
        _users = users;
        _tokens = tokens;
        _pwd = pwd;
        _jwt = jwt;
    }

    public async Task<AuthResponse> Handle(LoginCommand cmd, CancellationToken ct)
    {
        var user = await _users.GetByEmailAsync(cmd.Email.ToLowerInvariant(), ct)
            ?? throw new UnauthorizedAccessException("Geçersiz e-posta veya şifre.");

        if (!_pwd.Verify(cmd.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Geçersiz e-posta veya şifre.");

        if (!user.IsActive)
            throw new UnauthorizedAccessException("Hesap devre dışı.");

        var accessToken = _jwt.GenerateAccessToken(user);
        var refreshTokenValue = _jwt.GenerateRefreshToken();

        var refreshToken = new RefreshToken
        {
            Token = refreshTokenValue,
            UserId = user.Id,
            ExpiresAt = DateTime.UtcNow.AddDays(30)
        };

        await _tokens.AddAsync(refreshToken, ct);
        await _tokens.SaveChangesAsync(ct);

        return new AuthResponse(
            accessToken,
            refreshTokenValue,
            DateTime.UtcNow.AddMinutes(60),
            new UserDto(user.Id, user.FullName, user.Email, user.Role.ToString())
        );
    }
}
