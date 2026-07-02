using Microsoft.AspNetCore.Http;

namespace Picnivo.API.Features.Votes.CastVotes;

public class CastVotesEndpoint : IEndpoint
{
    public void Map(IEndpointRouteBuilder app) =>
        app.MapPut("/api/events/{token}/participants/{participantId}/votes", CastVotes.Handle)
           .WithName("CastVotes")
           .Produces(StatusCodes.Status204NoContent)
           .Produces(StatusCodes.Status404NotFound)
           .Produces(StatusCodes.Status400BadRequest)
           .ProducesValidationProblem();
}
