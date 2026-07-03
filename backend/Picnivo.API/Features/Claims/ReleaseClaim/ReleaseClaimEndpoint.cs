using Microsoft.AspNetCore.Http;

namespace Picnivo.API.Features.Claims.ReleaseClaim;

public class ReleaseClaimEndpoint : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapDelete("/api/events/{token}/items/{itemId}/claim", ReleaseClaim.Handle)
            .WithName("ReleaseClaim")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound);
}
