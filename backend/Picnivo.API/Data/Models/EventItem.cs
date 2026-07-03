namespace Picnivo.API.Data.Models;

public class EventItem
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public string Label { get; set; } = string.Empty;
    public Guid? AddedByParticipantId { get; set; }
    public Guid? OrphanedFromParticipantId { get; set; }

    public Event? Event { get; set; }
    public Participant? AddedByParticipant { get; set; }
    public Participant? OrphanedFromParticipant { get; set; }
    public ItemClaim? Claim { get; set; }
}
