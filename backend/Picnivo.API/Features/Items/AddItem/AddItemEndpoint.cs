using Microsoft.AspNetCore.Http;

namespace Picnivo.API.Features.Items.AddItem;

public class AddItemEndpoint : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapPost("/api/events/{token}/items", AddItem.Handle)
            .WithName("AddItem")
            .Produces<AddItemResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status409Conflict)
            .ProducesValidationProblem();
}
