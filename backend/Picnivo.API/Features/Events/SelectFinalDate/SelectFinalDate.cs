using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.API.Features.Streaming;

namespace Picnivo.API.Features.Events.SelectFinalDate;

public static class SelectFinalDate
{
    public static async Task<IResult> Handle(
        string token,
        SelectFinalDateRequest req,
        ClaimsPrincipal user,
        PicnivoDbContext db,
        IEventStreamBroker broker,
        CancellationToken ct
    )
    {
        if (!Guid.TryParse(user.FindFirstValue("sub"), out var organizerId))
        {
            return Results.Unauthorized();
        }

        var @event = await db
            .Events.Where(e => e.Token == token)
            .Select(e => new
            {
                e.Id,
                e.OrganizerId,
                DateOptions = e.DateOptions.Select(d => new { d.Id, d.StartsAt }).ToList(),
            })
            .FirstOrDefaultAsync(ct);

        if (@event is null)
        {
            return Results.NotFound();
        }

        if (@event.OrganizerId != organizerId)
        {
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        }

        if (
            req.DateOptionId is { } dateOptionId
            && !@event.DateOptions.Any(d => d.Id == dateOptionId)
        )
        {
            return Results.BadRequest();
        }

        if (req.DateOptionId is { } chosenId && !req.Force)
        {
            var dateOptionIds = @event.DateOptions.Select(d => d.Id).ToList();
            var votes = await db
                .DateVotes.Where(v => dateOptionIds.Contains(v.DateOptionId))
                .Select(v => new { v.DateOptionId, v.Choice })
                .ToListAsync(ct);

            int CountFor(Guid dateOptionId, VoteChoice choice) =>
                votes.Count(v => v.DateOptionId == dateOptionId && v.Choice == choice);

            var currentBest = Event.ResolveBestDateOptionId(
                [
                    .. @event.DateOptions.Select(d => new DateOptionTally(
                        d.Id,
                        d.StartsAt,
                        CountFor(d.Id, VoteChoice.Yes),
                        CountFor(d.Id, VoteChoice.No)
                    )),
                ]
            );

            if (currentBest != chosenId)
            {
                return Results.Conflict(new SelectFinalDateConflictResponse(currentBest));
            }
        }

        var entity = await db.Events.FirstAsync(e => e.Id == @event.Id, ct);
        entity.ChosenDateOptionId = req.DateOptionId;
        await db.SaveChangesAsync(ct);
        broker.Publish(token);

        return Results.NoContent();
    }
}
