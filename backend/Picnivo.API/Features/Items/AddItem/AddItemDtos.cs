namespace Picnivo.API.Features.Items.AddItem;

public record AddItemRequest(Guid ParticipantId, string Label);

public record AddItemResponse(Guid Id);
