using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;

namespace Picnivo.API.Features.Events.DeleteEvent;

public static class DeleteEvent
{
    public static async Task<IResult> Handle(
        string token,
        ClaimsPrincipal user,
        PicnivoDbContext db,
        CancellationToken ct
    )
    {
        if (!Guid.TryParse(user.FindFirstValue("sub"), out var organizerId))
        {
            return Results.Unauthorized();
        }

        var @event = await db.Events.FirstOrDefaultAsync(e => e.Token == token, ct);

        if (@event is null)
        {
            return Results.NotFound();
        }

        if (@event.OrganizerId != organizerId)
        {
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        }

        db.Events.Remove(@event);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Event was already deleted by a racing request; the caller's goal is satisfied.
        }

        return Results.NoContent();
    }
}
