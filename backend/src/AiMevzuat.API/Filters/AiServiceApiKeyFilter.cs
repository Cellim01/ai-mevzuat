using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace AiMevzuat.API.Filters;

public class AiServiceApiKeyFilter : IAsyncActionFilter
{
    private readonly IConfiguration _configuration;

    public AiServiceApiKeyFilter(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var expectedKey = _configuration["AiService:ApiKey"];
        if (string.IsNullOrEmpty(expectedKey))
            return next();

        var provided = context.HttpContext.Request.Headers["X-Api-Key"].FirstOrDefault();
        if (!string.Equals(provided, expectedKey, StringComparison.Ordinal))
        {
            context.Result = new UnauthorizedObjectResult(new { message = "Gecersiz API key." });
            return Task.CompletedTask;
        }

        return next();
    }
}
