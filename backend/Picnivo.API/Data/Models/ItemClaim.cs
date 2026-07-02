namespace Picnivo.API.Data.Models;

public class ItemClaim
{
    public Guid Id { get; set; }
    public Guid EventItemId { get; set; }
    public Guid ParticipantId { get; set; }
    public DateTimeOffset ClaimedAt { get; set; }

    public EventItem? EventItem { get; set; }
    public Participant? Participant { get; set; }
}
