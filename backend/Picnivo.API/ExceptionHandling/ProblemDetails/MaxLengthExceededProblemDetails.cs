using EntityFramework.Exceptions.Common;

namespace Picnivo.API.ExceptionHandling.ProblemDetails;

public class MaxLengthExceededProblemDetails : ExceptionProblemDetails<MaxLengthExceededException>
{
    public override int StatusCode => StatusCodes.Status400BadRequest;
}
