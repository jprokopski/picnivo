namespace Picnivo.API.Data.Models;

public class Participant
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public AttendanceStatus Attendance { get; set; } = AttendanceStatus.Undecided;
    public DateTimeOffset CreatedAt { get; set; }

    public Event? Event { get; set; }
    public ICollection<DateVote> Votes { get; set; } = new List<DateVote>();
    public ICollection<ItemClaim> Claims { get; set; } = new List<ItemClaim>();
}
