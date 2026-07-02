using Picnivo.API.Data.Models;

namespace Picnivo.API.Features.Events.GetEventByToken;

public record DateOptionDto(Guid Id, DateTimeOffset StartsAt, int YesCount, int MaybeCount, int NoCount);

public record EventItemDto(
    Guid Id,
    string Label,
    Guid? ClaimedByParticipantId,
    string? ClaimedByName,
    Guid? AddedByParticipantId,
    string? OrphanedFromName);

public record ParticipantDto(Guid Id, string DisplayName, AttendanceStatus Attendance);

public record YouVoteDto(Guid DateOptionId, VoteChoice Choice);

public record YouDto(
    IReadOnlyList<YouVoteDto> Votes,
    IReadOnlyList<Guid> ClaimedItemIds,
    AttendanceStatus Attendance);

public record EventDetailResponse(
    string Title,
    string? Description,
    string? Location,
    Guid OrganizerId,
    string OrganizerName,
    Guid? BestDateOptionId,
    Guid? ChosenDateOptionId,
    IReadOnlyList<DateOptionDto> DateOptions,
    IReadOnlyList<EventItemDto> Items,
    IReadOnlyList<ParticipantDto> Participants,
    YouDto? You);
