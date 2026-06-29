namespace Picnivo.API.Features.Events.GetEventByToken;

public record DateOptionDto(Guid Id, DateTimeOffset StartsAt);

public record EventItemDto(Guid Id, string Label);

public record EventDetailResponse(
    string Title,
    string? Description,
    string? Location,
    string OrganizerName,
    IReadOnlyList<DateOptionDto> DateOptions,
    IReadOnlyList<EventItemDto> Items);
