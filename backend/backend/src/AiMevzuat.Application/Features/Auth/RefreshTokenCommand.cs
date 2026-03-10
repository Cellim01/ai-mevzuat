using AiMevzuat.Application.Common.Interfaces;
using AiMevzuat.Application.DTOs;
using AiMevzuat.Application.Features.Gazette;
using AiMevzuat.Domain.Entities;
using AiMevzuat.Domain.Common;
using MediatR;

namespace AiMevzuat.Application.Features.Auth;

public record RefreshTokenCommand(string RefreshToken) : IRequest<AuthResponse>;

public class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, AuthResponse>
{
    private readonly IRefreshTokenRepository _tokenRepo;
    private readonly IJwtService _jwt;

    public RefreshTokenCommandHandler(IRefreshTokenRepository tokenRepo, IJwtService jwt)
    {
        _tokenRepo = tokenRepo;
        _jwt = jwt;
    }

    public async Task<AuthResponse> Handle(RefreshTokenCommand cmd, CancellationToken ct)
    {
        var existing = await _tokenRepo.GetActiveTokenAsync(cmd.RefreshToken, ct)
            ?? throw new UnauthorizedAccessException("Geçersiz veya süresi dolmuş token.");

        // Eski token'ı iptal et
        existing.RevokedAt = DateTime.UtcNow;

        // Yeni token üret
        var newRefreshValue = _jwt.GenerateRefreshToken();
        var newRefresh = new RefreshToken
        {
            Token = newRefreshValue,
            UserId = existing.UserId,
            ExpiresAt = DateTime.UtcNow.AddDays(30)
        };

        await _tokenRepo.AddAsync(newRefresh, ct);
        await _tokenRepo.SaveChangesAsync(ct);

        var user = existing.User;
        var accessToken = _jwt.GenerateAccessToken(user);

        return new AuthResponse(
            accessToken,
            newRefreshValue,
            DateTime.UtcNow.AddMinutes(60),
            new UserDto(user.Id, user.FullName, user.Email, user.Role.ToString())
        );
    }
}
