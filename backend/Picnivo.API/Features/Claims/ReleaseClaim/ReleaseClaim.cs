using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Features.Streaming;

namespace Picnivo.API.Features.Claims.ReleaseClaim;

public static class ReleaseClaim
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
            .Select(e => new { e.Id })
            .FirstOrDefaultAsync(ct);

        if (@event is null)
        {
            return Results.NotFound();
        }

        var itemBelongs = await db.EventItems.AnyAsync(
            i => i.Id == itemId && i.EventId == @event.Id,
            ct
        );

        if (!itemBelongs)
        {
            return Results.NotFound();
        }

        var claim = await db.ItemClaims.FirstOrDefaultAsync(
            c => c.EventItemId == itemId && c.ParticipantId == participantId,
            ct
        );

        if (claim is null)
        {
            return Results.NotFound();
        }

        db.ItemClaims.Remove(claim);
        await db.SaveChangesAsync(ct);
        broker.Publish(token);

        return Results.NoContent();
    }
}
