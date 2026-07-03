using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;

namespace Picnivo.API.Features.Participants.SetAttendance;

public static class SetAttendance
{
    public static async Task<IResult> Handle(
        string token,
        Guid participantId,
        SetAttendanceRequest req,
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

        var participant = await db.Participants.FirstOrDefaultAsync(
            p => p.Id == participantId && p.EventId == @event.Id,
            ct
        );

        if (participant is null)
        {
            return Results.NotFound();
        }

        participant.Attendance = req.Status;

        if (req.Status == AttendanceStatus.Out)
        {
            var claims = await db
                .ItemClaims.Where(c => c.ParticipantId == participantId)
                .ToListAsync(ct);

            if (claims.Count > 0)
            {
                var itemIds = claims.Select(c => c.EventItemId).ToList();
                var items = await db.EventItems.Where(i => itemIds.Contains(i.Id)).ToListAsync(ct);

                foreach (var item in items)
                {
                    item.OrphanedFromParticipantId = participantId;
                }

                db.ItemClaims.RemoveRange(claims);
            }
        }

        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }
}
