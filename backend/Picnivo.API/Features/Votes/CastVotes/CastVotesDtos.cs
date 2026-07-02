using Picnivo.API.Data.Models;

namespace Picnivo.API.Features.Votes.CastVotes;

public record VoteDto(Guid DateOptionId, VoteChoice Choice);

public record CastVotesRequest(IReadOnlyList<VoteDto> Votes);
