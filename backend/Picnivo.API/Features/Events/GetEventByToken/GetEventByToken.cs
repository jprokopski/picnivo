using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;

namespace Picnivo.API.Features.Events.GetEventByToken;

public static class GetEventByToken
{
    public static async Task<IResult> Handle(
        string token,
        Guid? participantId,
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
                e.ChosenDateOptionId,
                DateOptions = e.DateOptions.Select(d => new { d.Id, d.StartsAt }).ToList(),
                Items = e.Items.Select(i => new
                {
                    i.Id,
                    i.Label,
                    i.AddedByParticipantId,
                    ClaimedByParticipantId = i.Claim != null ? i.Claim.ParticipantId : (Guid?)null,
                    ClaimedByName = i.Claim != null ? i.Claim.Participant!.DisplayName : null,
                    OrphanedFromName = i.OrphanedFromParticipant != null ? i.OrphanedFromParticipant.DisplayName : null
                }).ToList(),
                Participants = e.Participants.Select(p => new { p.Id, p.DisplayName, p.Attendance }).ToList()
            })
            .FirstOrDefaultAsync(ct);

        if (raw is null)
        {
            return Results.NotFound();
        }

        var dateOptionIds = raw.DateOptions.Select(d => d.Id).ToList();
        var voteCounts = await db.DateVotes
            .Where(v => dateOptionIds.Contains(v.DateOptionId))
            .GroupBy(v => new { v.DateOptionId, v.Choice })
            .Select(g => new { g.Key.DateOptionId, g.Key.Choice, Count = g.Count() })
            .ToListAsync(ct);

        int CountFor(Guid dateOptionId, VoteChoice choice) =>
            voteCounts
                .Where(v => v.DateOptionId == dateOptionId && v.Choice == choice)
                .Select(v => v.Count)
                .FirstOrDefault();

        var bestDateOptionId = raw.DateOptions
            .OrderByDescending(d => CountFor(d.Id, VoteChoice.Yes))
            .ThenBy(d => CountFor(d.Id, VoteChoice.No))
            .ThenBy(d => d.StartsAt)
            .Select(d => (Guid?)d.Id)
            .FirstOrDefault();

        YouDto? you = null;
        if (participantId is { } pid && raw.Participants.Any(p => p.Id == pid))
        {
            var votes = await db.DateVotes
                .Where(v => v.ParticipantId == pid)
                .Select(v => new YouVoteDto(v.DateOptionId, v.Choice))
                .ToListAsync(ct);
            var claimedItemIds = raw.Items
                .Where(i => i.ClaimedByParticipantId == pid)
                .Select(i => i.Id)
                .ToList();
            var attendance = raw.Participants.First(p => p.Id == pid).Attendance;
            you = new YouDto(votes, claimedItemIds, attendance);
        }

        return Results.Ok(new EventDetailResponse(
            raw.Title,
            raw.Description,
            raw.Location,
            raw.OrganizerName,
            bestDateOptionId,
            raw.ChosenDateOptionId,
            [.. raw.DateOptions
                .OrderBy(d => d.StartsAt)
                .Select(d => new DateOptionDto(
                    d.Id, d.StartsAt,
                    CountFor(d.Id, VoteChoice.Yes),
                    CountFor(d.Id, VoteChoice.Maybe),
                    CountFor(d.Id, VoteChoice.No)))],
            [.. raw.Items.Select(i => new EventItemDto(
                i.Id, i.Label, i.ClaimedByParticipantId, i.ClaimedByName, i.AddedByParticipantId, i.OrphanedFromName))],
            [.. raw.Participants.Select(p => new ParticipantDto(p.Id, p.DisplayName, p.Attendance))],
            you));
    }
}
