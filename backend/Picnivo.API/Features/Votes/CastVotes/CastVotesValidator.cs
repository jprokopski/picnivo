using FluentValidation;
using Picnivo.API.Data.Models;

namespace Picnivo.API.Features.Votes.CastVotes;

public class CastVotesValidator : AbstractValidator<CastVotesRequest>
{
    public CastVotesValidator()
    {
        RuleFor(x => x.Votes).NotEmpty();

        RuleFor(x => x.Votes)
            .Must(votes => votes.Select(v => v.DateOptionId).Distinct().Count() == votes.Count)
            .WithMessage("Duplicate dateOptionId in votes.");

        RuleForEach(x => x.Votes)
            .ChildRules(vote =>
            {
                vote.RuleFor(v => v.Choice).IsInEnum().NotEqual(VoteChoice.Invalid);
            });
    }
}
