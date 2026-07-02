using Microsoft.AspNetCore.Http;

namespace Picnivo.API.Features.Events.CreateEvent;

public class CreateEventEndpoint : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapPost("/api/events", CreateEvent.Handle)
           .RequireAuthorization()
           .WithName("CreateEvent")
           .Produces<CreateEventResponse>(StatusCodes.Status201Created)
           .ProducesValidationProblem();
}
