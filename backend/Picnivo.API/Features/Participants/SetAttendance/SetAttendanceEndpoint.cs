using Microsoft.AspNetCore.Http;

namespace Picnivo.API.Features.Participants.SetAttendance;

public class SetAttendanceEndpoint : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapPut(
                "/api/events/{token}/participants/{participantId}/attendance",
                SetAttendance.Handle
            )
            .WithName("SetAttendance")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound)
            .ProducesValidationProblem();
}
