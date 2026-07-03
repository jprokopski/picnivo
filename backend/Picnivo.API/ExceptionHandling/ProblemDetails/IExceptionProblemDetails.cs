namespace Picnivo.API.ExceptionHandling.ProblemDetails;

public interface IExceptionProblemDetails
{
    Type ExceptionType { get; }
    int StatusCode { get; }
}
