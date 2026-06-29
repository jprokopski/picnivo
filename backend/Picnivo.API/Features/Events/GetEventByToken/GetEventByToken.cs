using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;

namespace Picnivo.API.Features.Events.GetEventByToken;

public static class GetEventByToken
{
    public static async Task<IResult> Handle(
        string token,
        PicnivoDbContext db,
        CancellationToken ct)
    {
        var raw = await db.Events
            .Where(e => e.Token == token)
            .Select(e => new
            {
                e.Title,
                e.Description,
                e.Location,
                OrganizerName = e.Organizer!.DisplayName,
                DateOptions = e.DateOptions.Select(d => new DateOptionDto(d.Id, d.StartsAt)).ToList(),
                Items = e.Items.Select(i => new EventItemDto(i.Id, i.Label)).ToList()
            })
            .FirstOrDefaultAsync(ct);

        if (raw is null)
        {
            return Results.NotFound();
        }

        return Results.Ok(new EventDetailResponse(
            raw.Title,
            raw.Description,
            raw.Location,
            raw.OrganizerName,
            [.. raw.DateOptions.OrderBy(d => d.StartsAt)],
            raw.Items));
    }
}
