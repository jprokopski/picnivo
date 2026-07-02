namespace Picnivo.API.ExceptionHandling.ProblemDetails;

public abstract class ExceptionProblemDetails<TException> : IExceptionProblemDetails
    where TException : Exception
{
    public Type ExceptionType => typeof(TException);

    public virtual int StatusCode => StatusCodes.Status500InternalServerError;
}
