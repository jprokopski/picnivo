using EntityFramework.Exceptions.Common;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;

namespace Picnivo.API.Features.Votes.CastVotes;

public static class CastVotes
{
    public static async Task<IResult> Handle(
        string token,
        Guid participantId,
        CastVotesRequest req,
        PicnivoDbContext db,
        CancellationToken ct
    )
    {
        var @event = await db
            .Events.Where(e => e.Token == token)
            .Select(e => new { e.Id, DateOptionIds = e.DateOptions.Select(d => d.Id).ToList() })
            .FirstOrDefaultAsync(ct);

        if (@event is null)
        {
            return Results.NotFound();
        }

        if (@event.DateOptionIds.Count <= 1)
        {
            return Results.BadRequest();
        }

        var participantBelongs = await db.Participants.AnyAsync(
            p => p.Id == participantId && p.EventId == @event.Id,
            ct
        );

        if (!participantBelongs)
        {
            return Results.NotFound();
        }

        if (req.Votes.Any(v => !@event.DateOptionIds.Contains(v.DateOptionId)))
        {
            return Results.BadRequest();
        }

        var dateOptionIds = req.Votes.Select(v => v.DateOptionId).ToList();
        var existing = await db
            .DateVotes.Where(v =>
                v.ParticipantId == participantId && dateOptionIds.Contains(v.DateOptionId)
            )
            .ToListAsync(ct);

        ApplyVotes(db, req, participantId, existing);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (UniqueConstraintException)
        {
            // A concurrent first-vote on the same (participant, dateOption) lost the race:
            // our speculative INSERT collided with the winner's row. Drop it, re-read the
            // now-existing row, and retry as an update — one vote request resolving to an
            // idempotent 204 rather than leaking the global 409.
            foreach (var entry in db.ChangeTracker.Entries<DateVote>().ToList())
            {
                if (entry.State == EntityState.Added)
                {
                    entry.State = EntityState.Detached;
                }
            }

            var afterRace = await db
                .DateVotes.Where(v =>
                    v.ParticipantId == participantId && dateOptionIds.Contains(v.DateOptionId)
                )
                .ToListAsync(ct);

            ApplyVotes(db, req, participantId, afterRace);
            await db.SaveChangesAsync(ct);
        }

        return Results.NoContent();
    }

    private static void ApplyVotes(
        PicnivoDbContext db,
        CastVotesRequest req,
        Guid participantId,
        List<DateVote> existing
    )
    {
        foreach (var vote in req.Votes)
        {
            var current = existing.FirstOrDefault(v => v.DateOptionId == vote.DateOptionId);
            if (current is not null)
            {
                current.Choice = vote.Choice;
            }
            else
            {
                db.DateVotes.Add(
                    new DateVote
                    {
                        Id = Guid.CreateVersion7(),
                        ParticipantId = participantId,
                        DateOptionId = vote.DateOptionId,
                        Choice = vote.Choice,
                    }
                );
            }
        }
    }
}
