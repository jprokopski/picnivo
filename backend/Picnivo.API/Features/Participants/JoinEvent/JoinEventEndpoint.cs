using Microsoft.AspNetCore.Http;

namespace Picnivo.API.Features.Participants.JoinEvent;

public class JoinEventEndpoint : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapPost("/api/events/{token}/participants", JoinEvent.Handle)
            .WithName("JoinEvent")
            .Produces<JoinEventResponse>()
            .Produces(StatusCodes.Status404NotFound)
            .ProducesValidationProblem();
}
