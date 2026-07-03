namespace Picnivo.API.Features.Events.CreateEvent;

public record CreateEventRequest(
    string Title,
    string? Description,
    string? Location,
    IReadOnlyList<DateTimeOffset> DateOptions,
    IReadOnlyList<string> Items
);

public record CreateEventResponse(Guid Id, string Token, Guid ParticipantId);
