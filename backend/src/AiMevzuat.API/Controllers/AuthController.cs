using AiMevzuat.Application.DTOs;
using AiMevzuat.Application.Features.Auth;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace AiMevzuat.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IMediator _mediator;

    public AuthController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>Yeni kullanıcı kaydı</summary>
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(
        [FromBody] RegisterRequest req, CancellationToken ct)
    {
        var result = await _mediator.Send(
            new RegisterCommand(req.FullName, req.Email, req.Password), ct);
        return Ok(result);
    }

    /// <summary>Giriş yap, JWT + RefreshToken al</summary>
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(
        [FromBody] LoginRequest req, CancellationToken ct)
    {
        try
        {
            var result = await _mediator.Send(
                new LoginCommand(req.Email, req.Password), ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    /// <summary>Access token yenile</summary>
    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh(
        [FromBody] RefreshTokenRequest req, CancellationToken ct)
    {
        try
        {
            var result = await _mediator.Send(
                new RefreshTokenCommand(req.RefreshToken), ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }
}
