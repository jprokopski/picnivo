using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;

namespace Picnivo.API.Features.Items.RemoveItem;

public static class RemoveItem
{
    public static async Task<IResult> Handle(
        string token,
        Guid itemId,
        Guid? participantId,
        ClaimsPrincipal user,
        PicnivoDbContext db,
        CancellationToken ct
    )
    {
        var @event = await db
            .Events.Where(e => e.Token == token)
            .Select(e => new { e.Id, e.OrganizerId })
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

        var isOrganizer =
            Guid.TryParse(user.FindFirstValue("sub"), out var organizerId)
            && organizerId == @event.OrganizerId;
        var isAdder = participantId is { } pid && item.AddedByParticipantId == pid;

        if (!isOrganizer && !isAdder)
        {
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        }

        db.EventItems.Remove(item);
        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }
}
