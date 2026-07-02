namespace Picnivo.API.Data.Models;

public class DateOption
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public DateTimeOffset StartsAt { get; set; }

    public Event? Event { get; set; }
}
