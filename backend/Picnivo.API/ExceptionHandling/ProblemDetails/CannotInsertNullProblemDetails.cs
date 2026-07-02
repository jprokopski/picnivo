using EntityFramework.Exceptions.Common;

namespace Picnivo.API.ExceptionHandling.ProblemDetails;

public class CannotInsertNullProblemDetails : ExceptionProblemDetails<CannotInsertNullException>
{
    public override int StatusCode => StatusCodes.Status400BadRequest;
}
