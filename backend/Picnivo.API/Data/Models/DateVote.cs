namespace Picnivo.API.Data.Models;

public class DateVote
{
    public Guid Id { get; set; }
    public Guid ParticipantId { get; set; }
    public Guid DateOptionId { get; set; }
    public VoteChoice Choice { get; set; }

    public Participant? Participant { get; set; }
    public DateOption? DateOption { get; set; }
}
