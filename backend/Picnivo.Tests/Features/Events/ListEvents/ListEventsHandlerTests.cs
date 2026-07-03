using System.Security.Claims;
using ListEventsHandler = Picnivo.API.Features.Events.ListEvents.ListEvents;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.API.Features.Events.ListEvents;

namespace Picnivo.Tests.Features.Events.ListEvents;

public class ListEventsHandlerTests
{
    [Fact]
    public async Task ReturnsOnlyCallerEvents()
    {
        // Arrange
        await using var db = TestDb.Create();
        var orgA = Guid.NewGuid();
        var orgB = Guid.NewGuid();
        db.Organizers.AddRange(
            new Organizer { Id = orgA, DisplayName = "A", CreatedAt = DateTimeOffset.UtcNow },
            new Organizer { Id = orgB, DisplayName = "B", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var tokenA = await SeedEventAsync(db, orgA, "A's picnic", token: "tokenorgA01");
        await SeedEventAsync(db, orgB, "B's picnic", token: "tokenorgB01");

        // Act
        var result = await ListEventsHandler.Handle(UserWith(orgA), db, CancellationToken.None);

        // Assert
        var ok = result.ShouldBeOfType<Ok<List<EventSummaryResponse>>>();
        ok.Value!.ShouldContain(s => s.Token == tokenA);
        ok.Value!.ShouldNotContain(s => s.Title == "B's picnic");
    }

    [Fact]
    public async Task SummaryHasCorrectCounts()
    {
        // Arrange
        await using var db = TestDb.Create();
        var orgId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = orgId, DisplayName = "Test", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var token = await SeedEventAsync(db, orgId, "Count Test", dateCount: 3, items: ["A", "B", "C", "D"]);

        // Act
        var result = await ListEventsHandler.Handle(UserWith(orgId), db, CancellationToken.None);

        // Assert
        var ok = result.ShouldBeOfType<Ok<List<EventSummaryResponse>>>();
        var summary = ok.Value!.Single(s => s.Token == token);
        summary.DateOptionCount.ShouldBe(3);
        summary.ItemCount.ShouldBe(4);
        summary.SoonestDate.ShouldNotBeNull();
    }

    [Fact]
    public async Task SummaryHasParticipantClaimAndChosenDateData()
    {
        // Arrange
        await using var db = TestDb.Create();
        var orgId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = orgId, DisplayName = "Test", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var dateOptionA = new DateOption { Id = Guid.CreateVersion7(), StartsAt = DateTimeOffset.UtcNow.AddDays(8) };
        var itemA = new EventItem { Id = Guid.CreateVersion7(), Label = "Sandwiches" };
        var itemB = new EventItem { Id = Guid.CreateVersion7(), Label = "Drinks" };
        var @event = new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = orgId,
            Title = "Dashboard Test",
            Token = "dashboardtoken1",
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions = [dateOptionA],
            Items = [itemA, itemB]
        };
        db.Events.Add(@event);
        await db.SaveChangesAsync();
        @event.ChosenDateOptionId = dateOptionA.Id;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var alice = new Participant { Id = Guid.CreateVersion7(), EventId = @event.Id, DisplayName = "Alice", CreatedAt = DateTimeOffset.UtcNow };
        var bob = new Participant { Id = Guid.CreateVersion7(), EventId = @event.Id, DisplayName = "Bob", CreatedAt = DateTimeOffset.UtcNow.AddMinutes(1) };
        db.Participants.AddRange(alice, bob);
        db.ItemClaims.Add(new ItemClaim { Id = Guid.CreateVersion7(), EventItemId = itemA.Id, ParticipantId = alice.Id, ClaimedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        // Act
        var result = await ListEventsHandler.Handle(UserWith(orgId), db, CancellationToken.None);

        // Assert
        var ok = result.ShouldBeOfType<Ok<List<EventSummaryResponse>>>();
        var summary = ok.Value!.Single(s => s.Token == "dashboardtoken1");
        summary.ParticipantCount.ShouldBe(2);
        summary.ParticipantNames.ShouldBe(["Alice", "Bob"]);
        summary.ClaimedCount.ShouldBe(1);
        summary.ChosenDateOptionId.ShouldBe(dateOptionA.Id);
        summary.ChosenDateStartsAt.ShouldBe(dateOptionA.StartsAt);
    }

    [Fact]
    public async Task ExcludesOrganizerFromParticipantCountAndNames()
    {
        // Arrange
        await using var db = TestDb.Create();
        var orgId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = orgId, DisplayName = "Test", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var token = await SeedEventAsync(db, orgId, "Host Picnic");
        var @event = await db.Events.SingleAsync(e => e.Token == token);

        var organizerParticipant = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = @event.Id,
            DisplayName = "Test",
            IsOrganizer = true,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        var guest = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = @event.Id,
            DisplayName = "Alice",
            CreatedAt = DateTimeOffset.UtcNow.AddMinutes(1),
        };
        db.Participants.AddRange(organizerParticipant, guest);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        // Act
        var result = await ListEventsHandler.Handle(UserWith(orgId), db, CancellationToken.None);

        // Assert
        var ok = result.ShouldBeOfType<Ok<List<EventSummaryResponse>>>();
        var summary = ok.Value!.Single(s => s.Token == token);
        summary.ParticipantCount.ShouldBe(1);
        summary.ParticipantNames.ShouldBe(["Alice"]);
    }

    [Fact]
    public async Task WithSingleDateEvent_TreatsLoneDateAsChosen()
    {
        // Arrange
        await using var db = TestDb.Create();
        var orgId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = orgId, DisplayName = "Test", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var lone = new DateOption { Id = Guid.CreateVersion7(), StartsAt = DateTimeOffset.UtcNow.AddDays(3) };
        db.Events.Add(new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = orgId,
            Title = "Announcement Picnic",
            Token = "announcetoken1",
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions = [lone]
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        // Act
        var result = await ListEventsHandler.Handle(UserWith(orgId), db, CancellationToken.None);

        // Assert
        var ok = result.ShouldBeOfType<Ok<List<EventSummaryResponse>>>();
        var summary = ok.Value!.Single(s => s.Token == "announcetoken1");
        summary.ChosenDateOptionId.ShouldBe(lone.Id);
        summary.ChosenDateStartsAt.ShouldBe(lone.StartsAt);
    }

    [Fact]
    public async Task WithMultipleDatesAndNoLock_ChosenDateOptionIdIsNull()
    {
        // Arrange
        await using var db = TestDb.Create();
        var orgId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = orgId, DisplayName = "Test", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var token = await SeedEventAsync(db, orgId, "Undecided Picnic", dateCount: 2);

        // Act
        var result = await ListEventsHandler.Handle(UserWith(orgId), db, CancellationToken.None);

        // Assert
        var ok = result.ShouldBeOfType<Ok<List<EventSummaryResponse>>>();
        var summary = ok.Value!.Single(s => s.Token == token);
        summary.ChosenDateOptionId.ShouldBeNull();
        summary.ChosenDateStartsAt.ShouldBeNull();
    }

    private static ClaimsPrincipal UserWith(Guid organizerId) =>
        new(new ClaimsIdentity([new Claim("sub", organizerId.ToString())]));

    private static async Task<string> SeedEventAsync(
        PicnivoDbContext db,
        Guid organizerId,
        string title,
        int dateCount = 2,
        string[]? items = null,
        string token = "testtoken01")
    {
        db.Events.Add(new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = title,
            Token = token,
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions = Enumerable.Range(1, dateCount)
                .Select(i => new DateOption { Id = Guid.CreateVersion7(), StartsAt = DateTimeOffset.UtcNow.AddDays(7 + i) })
                .ToList(),
            Items = (items ?? [])
                .Select(l => new EventItem { Id = Guid.CreateVersion7(), Label = l })
                .ToList()
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return token;
    }
}
