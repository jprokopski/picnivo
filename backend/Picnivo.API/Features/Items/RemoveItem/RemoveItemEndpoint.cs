using Microsoft.AspNetCore.Http;

namespace Picnivo.API.Features.Items.RemoveItem;

public class RemoveItemEndpoint : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapDelete("/api/events/{token}/items/{itemId}", RemoveItem.Handle)
            .WithName("RemoveItem")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound);
}
