using Microsoft.AspNetCore.Http;

namespace Picnivo.API.Features.Events.SelectFinalDate;

public class SelectFinalDateEndpoint : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapPut("/api/events/{token}/chosen-date", SelectFinalDate.Handle)
            .RequireAuthorization()
            .WithName("SelectFinalDate")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound);
}
