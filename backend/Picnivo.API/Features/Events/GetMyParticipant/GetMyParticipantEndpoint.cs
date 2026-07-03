using Microsoft.AspNetCore.Http;

namespace Picnivo.API.Features.Events.GetMyParticipant;

public class GetMyParticipantEndpoint : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapGet("/api/events/{token}/me", GetMyParticipant.Handle)
            .RequireAuthorization()
            .WithName("GetMyParticipant")
            .Produces<GetMyParticipantResponse>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status404NotFound);
}
