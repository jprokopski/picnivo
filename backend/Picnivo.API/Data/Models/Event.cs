namespace Picnivo.API.Data.Models;

public class Event
{
    public Guid Id { get; set; }
    public Guid OrganizerId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Location { get; set; }
    public string Token { get; set; } = string.Empty;
    public Guid? ChosenDateOptionId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public Organizer? Organizer { get; set; }
    public DateOption? ChosenDateOption { get; set; }
    public ICollection<DateOption> DateOptions { get; set; } = new List<DateOption>();
    public ICollection<EventItem> Items { get; set; } = new List<EventItem>();
    public ICollection<Participant> Participants { get; set; } = new List<Participant>();
}
