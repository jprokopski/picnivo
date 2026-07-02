namespace Picnivo.API.Features.Participants.JoinEvent;

public record JoinEventRequest(string DisplayName);

public record JoinEventResponse(Guid ParticipantId, bool DuplicateName);
