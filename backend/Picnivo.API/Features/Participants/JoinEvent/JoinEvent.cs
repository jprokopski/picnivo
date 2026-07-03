using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;

namespace Picnivo.API.Features.Participants.JoinEvent;

public static class JoinEvent
{
    public static async Task<IResult> Handle(
        string token,
        JoinEventRequest req,
        PicnivoDbContext db,
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

        var displayName = req.DisplayName.Trim();

        var duplicateName = await db
            .Participants.Where(p => p.EventId == @event.Id)
            .AnyAsync(p => p.DisplayName.ToLower() == displayName.ToLower(), ct);

        var participant = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = @event.Id,
            DisplayName = displayName,
            Attendance = AttendanceStatus.Undecided,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        db.Participants.Add(participant);
        await db.SaveChangesAsync(ct);

        return Results.Ok(new JoinEventResponse(participant.Id, duplicateName));
    }
}
