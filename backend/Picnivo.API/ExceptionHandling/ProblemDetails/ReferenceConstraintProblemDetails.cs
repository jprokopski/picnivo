using EntityFramework.Exceptions.Common;

namespace Picnivo.API.ExceptionHandling.ProblemDetails;

public class ReferenceConstraintProblemDetails
    : ExceptionProblemDetails<ReferenceConstraintException>
{
    public override int StatusCode => StatusCodes.Status409Conflict;
}
