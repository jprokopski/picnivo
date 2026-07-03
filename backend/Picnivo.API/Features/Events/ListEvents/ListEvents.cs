using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;

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
                ItemCount = e.Items.Count,
                DateOptions = e.DateOptions.Select(d => new { d.Id, d.StartsAt }).ToList(),
                ParticipantCount = e.Participants.Count(p => !p.IsOrganizer),
                Participants = e.Participants
                    .Where(p => !p.IsOrganizer)
                    .Select(p => new { p.DisplayName, p.CreatedAt })
                    .ToList(),
                ClaimedCount = e.Items.Count(i => i.Claim != null)
            })
            .ToListAsync(ct);

        var now = DateTimeOffset.UtcNow;
        var summaries = raw
            .Select(e =>
            {
                var dateOptionIds = e.DateOptions.Select(d => d.Id).ToList();
                var chosenDateOptionId = Event.ResolveEffectiveChosenDateOptionId(
                    e.ChosenDateOptionId, dateOptionIds);
                var chosenDateStartsAt = chosenDateOptionId is { } id
                    ? e.DateOptions.First(d => d.Id == id).StartsAt
                    : (DateTimeOffset?)null;
                return new EventSummaryResponse(
                    e.Id, e.Title, e.Location, e.Token, e.CreatedAt,
                    e.DateOptions.Count, e.ItemCount,
                    e.DateOptions.Select(d => d.StartsAt).Where(d => d > now).Select(d => (DateTimeOffset?)d).Min(),
                    e.ParticipantCount,
                    e.Participants.OrderBy(p => p.CreatedAt).Select(p => p.DisplayName).Take(6).ToList(),
                    e.ClaimedCount,
                    chosenDateOptionId, chosenDateStartsAt);
            })
            .OrderBy(e => e.SoonestDate ?? DateTimeOffset.MaxValue)
            .ThenBy(e => e.CreatedAt)
            .ToList();

        return Results.Ok(summaries);
    }
}
