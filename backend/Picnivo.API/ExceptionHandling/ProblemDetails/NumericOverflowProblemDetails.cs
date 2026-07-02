using EntityFramework.Exceptions.Common;

namespace Picnivo.API.ExceptionHandling.ProblemDetails;

public class NumericOverflowProblemDetails : ExceptionProblemDetails<NumericOverflowException>
{
    public override int StatusCode => StatusCodes.Status400BadRequest;
}
