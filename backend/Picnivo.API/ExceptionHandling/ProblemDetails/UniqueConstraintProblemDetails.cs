using EntityFramework.Exceptions.Common;

namespace Picnivo.API.ExceptionHandling.ProblemDetails;

public class UniqueConstraintProblemDetails : ExceptionProblemDetails<UniqueConstraintException>
{
    public override int StatusCode => StatusCodes.Status409Conflict;
}
