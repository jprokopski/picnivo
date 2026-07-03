using System.Diagnostics.CodeAnalysis;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Picnivo.API.ExceptionHandling.ProblemDetails;

namespace Picnivo.API.ExceptionHandling;

[RequiresUnreferencedCode(
    "Scans the assembly for IExceptionProblemDetails implementations via reflection."
)]
public class GlobalExceptionHandler(IProblemDetailsService problemDetailsService)
    : IExceptionHandler
{
    private static readonly Dictionary<Type, int> StatusCodesByExceptionType = typeof(Program)
        .Assembly.GetTypes()
        .Where(t =>
            t is { IsClass: true, IsAbstract: false }
            && t.IsAssignableTo(typeof(IExceptionProblemDetails))
        )
        .Select(t => (IExceptionProblemDetails)Activator.CreateInstance(t)!)
        .ToDictionary(p => p.ExceptionType, p => p.StatusCode);

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken
    )
    {
        var statusCode = StatusCodesByExceptionType.GetValueOrDefault(
            exception.GetType(),
            StatusCodes.Status500InternalServerError
        );

        httpContext.Response.StatusCode = statusCode;

        return await problemDetailsService.TryWriteAsync(
            new ProblemDetailsContext
            {
                HttpContext = httpContext,
                Exception = exception,
                ProblemDetails = new Microsoft.AspNetCore.Mvc.ProblemDetails
                {
                    Status = statusCode,
                },
            }
        );
    }
}
