namespace Picnivo.API.Data.Models;

public class EventItem
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public string Label { get; set; } = string.Empty;

    public Event? Event { get; set; }
}
