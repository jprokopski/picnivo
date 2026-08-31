namespace Picnivo.API.Features.Streaming.StreamEvent;

public class StreamEventEndpoint : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapGet("/api/events/{token}/stream", StreamEvent.Handle)
            .WithName("StreamEvent")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);
}
