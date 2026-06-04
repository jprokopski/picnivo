namespace Picnivo.API.Data.Models;

public class Organizer
{
    public Guid Id { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}
