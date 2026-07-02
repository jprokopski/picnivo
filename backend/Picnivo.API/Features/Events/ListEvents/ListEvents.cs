using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;

namespace Picnivo.API.Features.Events.ListEvents;

public static class ListEvents
{
    public static async Task<IResult> Handle(
        ClaimsPrincipal user,
        PicnivoDbContext db,
        CancellationToken ct)
    {
        if (!Guid.TryParse(user.FindFirstValue("sub"), out var organizerId))
        {
            return Results.Unauthorized();
        }

        var raw = await db.Events
            .Where(e => e.OrganizerId == organizerId)
            .Select(e => new
            {
                e.Id,
                e.Title,
                e.Location,
                e.Token,
                e.CreatedAt,
                DateOptionCount = e.DateOptions.Count,
                ItemCount = e.Items.Count,
                StartsAts = e.DateOptions.Select(d => d.StartsAt).ToList()
            })
            .ToListAsync(ct);

        var now = DateTimeOffset.UtcNow;
        var summaries = raw
            .Select(e => new EventSummaryResponse(
                e.Id, e.Title, e.Location, e.Token, e.CreatedAt,
                e.DateOptionCount, e.ItemCount,
                e.StartsAts.Where(d => d > now).Select(d => (DateTimeOffset?)d).Min()))
            .OrderBy(e => e.SoonestDate ?? DateTimeOffset.MaxValue)
            .ThenBy(e => e.CreatedAt)
            .ToList();

        return Results.Ok(summaries);
    }
}
