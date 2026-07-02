using Microsoft.AspNetCore.Http;

namespace Picnivo.API.Features.Claims.ClaimItem;

public class ClaimItemEndpoint : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapPost("/api/events/{token}/items/{itemId}/claim", ClaimItem.Handle)
           .WithName("ClaimItem")
           .Produces(StatusCodes.Status204NoContent)
           .Produces(StatusCodes.Status403Forbidden)
           .Produces(StatusCodes.Status404NotFound)
           .Produces(StatusCodes.Status409Conflict);
}
