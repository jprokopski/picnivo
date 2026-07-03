using Microsoft.AspNetCore.Http;

namespace Picnivo.API.Features.Events.GetEventByToken;

public class GetEventByTokenEndpoint : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapGet("/api/events/{token}", GetEventByToken.Handle)
            .WithName("GetEventByToken")
            .Produces<EventDetailResponse>()
            .Produces(StatusCodes.Status404NotFound);
}
