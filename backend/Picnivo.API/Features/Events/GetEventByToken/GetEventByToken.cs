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
                e.OrganizerId,
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
        var chosenDateOptionId = Event.ResolveEffectiveChosenDateOptionId(
            raw.ChosenDateOptionId, dateOptionIds);
        var allVotes = await db.DateVotes
            .Where(v => dateOptionIds.Contains(v.DateOptionId))
            .Select(v => new { v.ParticipantId, v.DateOptionId, v.Choice })
            .ToListAsync(ct);

        var isAnnouncement = dateOptionIds.Count == 1;

        int CountFor(Guid dateOptionId, VoteChoice choice)
        {
            var count = allVotes.Count(v => v.DateOptionId == dateOptionId && v.Choice == choice);
            if (isAnnouncement && choice == VoteChoice.Yes)
            {
                // Single-date events are a de-facto announcement (FR-004): no vote UI is
                // shown, so the organizer who set the date implicitly counts as attending.
                count++;
            }
            return count;
        }

        var bestDateOptionId = raw.DateOptions
            .OrderByDescending(d => CountFor(d.Id, VoteChoice.Yes))
            .ThenBy(d => CountFor(d.Id, VoteChoice.No))
            .ThenBy(d => d.StartsAt)
            .Select(d => (Guid?)d.Id)
            .FirstOrDefault();

        YouDto? you = null;
        if (participantId is { } pid && raw.Participants.Any(p => p.Id == pid))
        {
            var votes = allVotes
                .Where(v => v.ParticipantId == pid)
                .Select(v => new YouVoteDto(v.DateOptionId, v.Choice))
                .ToList();
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
            raw.OrganizerId,
            raw.OrganizerName,
            bestDateOptionId,
            chosenDateOptionId,
            [.. raw.DateOptions
                .OrderBy(d => d.StartsAt)
                .Select(d => new DateOptionDto(
                    d.Id, d.StartsAt,
                    CountFor(d.Id, VoteChoice.Yes),
                    CountFor(d.Id, VoteChoice.Maybe),
                    CountFor(d.Id, VoteChoice.No)))],
            [.. raw.Items.Select(i => new EventItemDto(
                i.Id, i.Label, i.ClaimedByParticipantId, i.ClaimedByName, i.AddedByParticipantId, i.OrphanedFromName))],
            [.. raw.Participants.Select(p => new ParticipantDto(
                p.Id, p.DisplayName, p.Attendance,
                [.. allVotes
                    .Where(v => v.ParticipantId == p.Id)
                    .Select(v => new ParticipantVoteDto(v.DateOptionId, v.Choice))]))],
            you));
    }
}
