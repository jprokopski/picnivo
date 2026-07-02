using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;

namespace Picnivo.API.Features.Items.AddItem;

public static class AddItem
{
    private const int MaxItems = 50;

    public static async Task<IResult> Handle(
        string token,
        AddItemRequest req,
        PicnivoDbContext db,
        CancellationToken ct)
    {
        var @event = await db.Events
            .Where(e => e.Token == token)
            .Select(e => new { e.Id })
            .FirstOrDefaultAsync(ct);

        if (@event is null)
        {
            return Results.NotFound();
        }

        var participantBelongs = await db.Participants
            .AnyAsync(p => p.Id == req.ParticipantId && p.EventId == @event.Id, ct);

        if (!participantBelongs)
        {
            return Results.NotFound();
        }

        var label = req.Label.Trim();

        var itemCount = await db.EventItems.CountAsync(i => i.EventId == @event.Id, ct);
        if (itemCount >= MaxItems)
        {
            return Results.BadRequest();
        }

        var duplicate = await db.EventItems
            .AnyAsync(i => i.EventId == @event.Id && i.Label.ToLower() == label.ToLower(), ct);

        if (duplicate)
        {
            return Results.Conflict();
        }

        var item = new EventItem
        {
            Id = Guid.CreateVersion7(),
            EventId = @event.Id,
            Label = label,
            AddedByParticipantId = req.ParticipantId
        };

        db.EventItems.Add(item);
        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/events/{token}/items/{item.Id}", new AddItemResponse(item.Id));
    }
}
