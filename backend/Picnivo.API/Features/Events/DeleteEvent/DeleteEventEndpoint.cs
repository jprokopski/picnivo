using Microsoft.AspNetCore.Http;

namespace Picnivo.API.Features.Events.DeleteEvent;

public class DeleteEventEndpoint : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapDelete("/api/events/{token}", DeleteEvent.Handle)
            .RequireAuthorization()
            .WithName("DeleteEvent")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound);
}
