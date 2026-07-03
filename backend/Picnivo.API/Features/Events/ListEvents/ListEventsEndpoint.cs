using Microsoft.AspNetCore.Http;

namespace Picnivo.API.Features.Events.ListEvents;

public class ListEventsEndpoint : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapGet("/api/events", ListEvents.Handle)
            .RequireAuthorization()
            .WithName("ListEvents")
            .Produces<IEnumerable<EventSummaryResponse>>();
}
