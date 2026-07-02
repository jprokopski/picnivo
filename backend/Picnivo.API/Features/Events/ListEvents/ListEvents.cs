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
                e.ChosenDateOptionId,
                ChosenDateStartsAt = e.ChosenDateOption != null ? e.ChosenDateOption.StartsAt : (DateTimeOffset?)null,
                DateOptionCount = e.DateOptions.Count,
                ItemCount = e.Items.Count,
                StartsAts = e.DateOptions.Select(d => d.StartsAt).ToList(),
                ParticipantCount = e.Participants.Count,
                Participants = e.Participants.Select(p => new { p.DisplayName, p.CreatedAt }).ToList(),
                ClaimedCount = e.Items.Count(i => i.Claim != null)
            })
            .ToListAsync(ct);

        var now = DateTimeOffset.UtcNow;
        var summaries = raw
            .Select(e => new EventSummaryResponse(
                e.Id, e.Title, e.Location, e.Token, e.CreatedAt,
                e.DateOptionCount, e.ItemCount,
                e.StartsAts.Where(d => d > now).Select(d => (DateTimeOffset?)d).Min(),
                e.ParticipantCount,
                e.Participants.OrderBy(p => p.CreatedAt).Select(p => p.DisplayName).Take(6).ToList(),
                e.ClaimedCount,
                e.ChosenDateOptionId, e.ChosenDateStartsAt))
            .OrderBy(e => e.SoonestDate ?? DateTimeOffset.MaxValue)
            .ThenBy(e => e.CreatedAt)
            .ToList();

        return Results.Ok(summaries);
    }
}
