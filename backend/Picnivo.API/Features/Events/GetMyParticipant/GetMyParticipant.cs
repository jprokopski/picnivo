using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;

namespace Picnivo.API.Features.Events.GetMyParticipant;

public static class GetMyParticipant
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

        var resolved = await db
            .Events.Where(e => e.Token == token)
            .Select(e => new
            {
                e.OrganizerId,
                ParticipantId = e
                    .Participants.Where(p => p.IsOrganizer)
                    .Select(p => (Guid?)p.Id)
                    .FirstOrDefault(),
            })
            .FirstOrDefaultAsync(ct);

        if (
            resolved is null
            || resolved.OrganizerId != organizerId
            || resolved.ParticipantId is null
        )
        {
            return Results.NotFound();
        }

        return Results.Ok(new GetMyParticipantResponse(resolved.ParticipantId.Value));
    }
}
