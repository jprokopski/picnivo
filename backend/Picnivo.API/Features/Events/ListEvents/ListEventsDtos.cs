namespace Picnivo.API.Features.Events.ListEvents;

public record EventSummaryResponse(
    Guid Id,
    string Title,
    string? Location,
    string Token,
    DateTimeOffset CreatedAt,
    int DateOptionCount,
    int ItemCount,
    DateTimeOffset? SoonestDate,
    int ParticipantCount,
    IReadOnlyList<string> ParticipantNames,
    int ClaimedCount,
    Guid? ChosenDateOptionId,
    DateTimeOffset? ChosenDateStartsAt);
