namespace Picnivo.API.Data.Models;

public readonly record struct DateOptionTally(
    Guid Id,
    DateTimeOffset StartsAt,
    int YesCount,
    int NoCount
);

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

    /// <summary>
    /// A 1-date event is a de-facto announcement (FR-004): its lone date is the
    /// effective chosen date even before the organizer explicitly locks one.
    /// </summary>
    public static Guid? ResolveEffectiveChosenDateOptionId(
        Guid? chosenDateOptionId,
        IReadOnlyCollection<Guid> dateOptionIds
    ) => chosenDateOptionId ?? (dateOptionIds.Count == 1 ? dateOptionIds.Single() : null);

    /// <summary>
    /// Ranks date options by most Yes votes, then fewest No votes, then earliest start —
    /// the single authoritative "best date" ordering shared by the read model and the
    /// organizer's lock-date staleness guard, so they never disagree.
    /// </summary>
    public static Guid? ResolveBestDateOptionId(IReadOnlyCollection<DateOptionTally> tallies) =>
        tallies
            .OrderByDescending(t => t.YesCount)
            .ThenBy(t => t.NoCount)
            .ThenBy(t => t.StartsAt)
            .Select(t => (Guid?)t.Id)
            .FirstOrDefault();
}
