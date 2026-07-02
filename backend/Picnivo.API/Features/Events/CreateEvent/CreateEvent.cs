using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;

namespace Picnivo.API.Features.Events.CreateEvent;

public static class CreateEvent
{
    public static async Task<IResult> Handle(
        CreateEventRequest req,
        ClaimsPrincipal user,
        PicnivoDbContext db,
        CancellationToken ct)
    {
        if (!Guid.TryParse(user.FindFirstValue("sub"), out var organizerId))
        {
            return Results.Unauthorized();
        }

        var title = req.Title.Trim();
        var description = req.Description?.Trim();
        var location = req.Location?.Trim();

        var itemLabels = (req.Items ?? [])
            .Select(l => l.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        string token;
        do { token = ShareTokenGenerator.Generate(); }
        while (await db.Events.AnyAsync(e => e.Token == token, ct));

        var @event = new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = title,
            Description = description,
            Location = location,
            Token = token,
            DateOptions = req.DateOptions
                .Select(d => new DateOption { Id = Guid.CreateVersion7(), StartsAt = d })
                .ToList(),
            Items = itemLabels
                .Select(l => new EventItem { Id = Guid.CreateVersion7(), Label = l })
                .ToList()
        };

        db.Events.Add(@event);
        await db.SaveChangesAsync(ct);
        return Results.Created(
            $"/api/events/{@event.Token}",
            new CreateEventResponse(@event.Id, @event.Token));
    }
}
