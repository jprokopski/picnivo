using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
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
                DateOptionIds = e.DateOptions.Select(d => d.Id).ToList(),
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

        if (req.DateOptionId is { } dateOptionId && !@event.DateOptionIds.Contains(dateOptionId))
        {
            return Results.BadRequest();
        }

        var entity = await db.Events.FirstAsync(e => e.Id == @event.Id, ct);
        entity.ChosenDateOptionId = req.DateOptionId;
        await db.SaveChangesAsync(ct);
        broker.Publish(token);

        return Results.NoContent();
    }
}
