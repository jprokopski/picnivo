using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.API.Features.Streaming;

namespace Picnivo.API.Features.Claims.ClaimItem;

public static class ClaimItem
{
    public static async Task<IResult> Handle(
        string token,
        Guid itemId,
        Guid participantId,
        PicnivoDbContext db,
        IEventStreamBroker broker,
        CancellationToken ct
    )
    {
        var @event = await db
            .Events.Where(e => e.Token == token)
            .Select(e => new
            {
                e.Id,
                e.ChosenDateOptionId,
                DateOptionIds = e.DateOptions.Select(d => d.Id).ToList(),
            })
            .FirstOrDefaultAsync(ct);

        if (@event is null)
        {
            return Results.NotFound();
        }

        var item = await db.EventItems.FirstOrDefaultAsync(
            i => i.Id == itemId && i.EventId == @event.Id,
            ct
        );

        if (item is null)
        {
            return Results.NotFound();
        }

        var participant = await db.Participants.FirstOrDefaultAsync(
            p => p.Id == participantId && p.EventId == @event.Id,
            ct
        );

        if (participant is null)
        {
            return Results.NotFound();
        }

        var chosenDateOptionId = Event.ResolveEffectiveChosenDateOptionId(
            @event.ChosenDateOptionId,
            @event.DateOptionIds
        );

        if (chosenDateOptionId is null)
        {
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        }

        var chosenId = chosenDateOptionId.Value;

        var isComing = participant.Attendance == AttendanceStatus.Coming;
        if (!isComing && participant.Attendance == AttendanceStatus.Undecided)
        {
            isComing = await db.DateVotes.AnyAsync(
                v =>
                    v.ParticipantId == participantId
                    && v.DateOptionId == chosenId
                    && v.Choice == VoteChoice.Yes,
                ct
            );
        }

        if (!isComing)
        {
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        }

        db.ItemClaims.Add(
            new ItemClaim
            {
                Id = Guid.CreateVersion7(),
                EventItemId = itemId,
                ParticipantId = participantId,
                ClaimedAt = DateTimeOffset.UtcNow,
            }
        );
        item.OrphanedFromParticipantId = null;

        await db.SaveChangesAsync(ct);
        broker.Publish(token);

        return Results.NoContent();
    }
}
