using GetEventByTokenHandler = Picnivo.API.Features.Events.GetEventByToken.GetEventByToken;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.API.Features.Events.GetEventByToken;

namespace Picnivo.Tests.Features.Events.GetEventByToken;

public class GetEventByTokenHandlerTests
{
    [Fact]
    public async Task ReturnsEventDetail()
    {
        // Arrange
        await using var db = TestDb.Create();
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = organizerId, DisplayName = "Organizer A", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var token = await SeedEventAsync(db, organizerId,
            title: "Token Detail Test",
            description: "My description",
            location: "My location",
            dateOptions: [DateTimeOffset.UtcNow.AddDays(10)],
            items: ["Balloons"]);

        // Act
        var result = await GetEventByTokenHandler.Handle(token, null, db, CancellationToken.None);

        // Assert
        var ok = result.ShouldBeOfType<Ok<EventDetailResponse>>();
        ok.Value!.Title.ShouldBe("Token Detail Test");
        ok.Value.Description.ShouldBe("My description");
        ok.Value.Location.ShouldBe("My location");
        ok.Value.OrganizerName.ShouldBe("Organizer A");
        ok.Value.DateOptions.ShouldHaveSingleItem();
        ok.Value.Items[0].Label.ShouldBe("Balloons");
    }

    [Fact]
    public async Task WithUnknownToken_ReturnsNotFound()
    {
        // Arrange
        await using var db = TestDb.Create();

        // Act
        var result = await GetEventByTokenHandler.Handle("unknowntoken", null, db, CancellationToken.None);

        // Assert
        result.ShouldBeOfType<NotFound>();
    }

    [Fact]
    public async Task ReturnsTalliesAndBestDateOptionId()
    {
        // Arrange
        await using var db = TestDb.Create();
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = organizerId, DisplayName = "Organizer A", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var token = await SeedEventAsync(db, organizerId,
            title: "Tally Test",
            dateOptions: [DateTimeOffset.UtcNow.AddDays(10), DateTimeOffset.UtcNow.AddDays(11)]);

        var @event = await db.Events.Include(e => e.DateOptions).SingleAsync(e => e.Token == token);
        var winningDate = @event.DateOptions.First();
        var losingDate = @event.DateOptions.Last();

        var alice = new Participant { Id = Guid.CreateVersion7(), EventId = @event.Id, DisplayName = "Alice", CreatedAt = DateTimeOffset.UtcNow };
        var bob = new Participant { Id = Guid.CreateVersion7(), EventId = @event.Id, DisplayName = "Bob", CreatedAt = DateTimeOffset.UtcNow };
        db.Participants.AddRange(alice, bob);
        db.DateVotes.AddRange(
            new DateVote { Id = Guid.CreateVersion7(), ParticipantId = alice.Id, DateOptionId = winningDate.Id, Choice = VoteChoice.Yes },
            new DateVote { Id = Guid.CreateVersion7(), ParticipantId = bob.Id, DateOptionId = winningDate.Id, Choice = VoteChoice.Yes },
            new DateVote { Id = Guid.CreateVersion7(), ParticipantId = alice.Id, DateOptionId = losingDate.Id, Choice = VoteChoice.No });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        // Act
        var result = await GetEventByTokenHandler.Handle(token, null, db, CancellationToken.None);

        // Assert
        var ok = result.ShouldBeOfType<Ok<EventDetailResponse>>();
        ok.Value!.BestDateOptionId.ShouldBe(winningDate.Id);
        var winningDto = ok.Value.DateOptions.Single(d => d.Id == winningDate.Id);
        winningDto.YesCount.ShouldBe(2);
        winningDto.NoCount.ShouldBe(0);
        var losingDto = ok.Value.DateOptions.Single(d => d.Id == losingDate.Id);
        losingDto.NoCount.ShouldBe(1);
    }

    [Fact]
    public async Task ReturnsEachParticipantsOwnVotes()
    {
        // Arrange
        await using var db = TestDb.Create();
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = organizerId, DisplayName = "Organizer A", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var token = await SeedEventAsync(db, organizerId,
            title: "Participant Votes Test",
            dateOptions: [DateTimeOffset.UtcNow.AddDays(10), DateTimeOffset.UtcNow.AddDays(11)]);

        var @event = await db.Events.Include(e => e.DateOptions).SingleAsync(e => e.Token == token);
        var dateA = @event.DateOptions.First();
        var dateB = @event.DateOptions.Last();

        var alice = new Participant { Id = Guid.CreateVersion7(), EventId = @event.Id, DisplayName = "Alice", CreatedAt = DateTimeOffset.UtcNow };
        var bob = new Participant { Id = Guid.CreateVersion7(), EventId = @event.Id, DisplayName = "Bob", CreatedAt = DateTimeOffset.UtcNow };
        db.Participants.AddRange(alice, bob);
        db.DateVotes.AddRange(
            new DateVote { Id = Guid.CreateVersion7(), ParticipantId = alice.Id, DateOptionId = dateA.Id, Choice = VoteChoice.Yes },
            new DateVote { Id = Guid.CreateVersion7(), ParticipantId = alice.Id, DateOptionId = dateB.Id, Choice = VoteChoice.No },
            new DateVote { Id = Guid.CreateVersion7(), ParticipantId = bob.Id, DateOptionId = dateA.Id, Choice = VoteChoice.Maybe });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        // Act
        var result = await GetEventByTokenHandler.Handle(token, null, db, CancellationToken.None);

        // Assert
        var ok = result.ShouldBeOfType<Ok<EventDetailResponse>>();
        var aliceDto = ok.Value!.Participants.Single(p => p.Id == alice.Id);
        aliceDto.Votes.Count.ShouldBe(2);
        aliceDto.Votes.Single(v => v.DateOptionId == dateA.Id).Choice.ShouldBe(VoteChoice.Yes);
        aliceDto.Votes.Single(v => v.DateOptionId == dateB.Id).Choice.ShouldBe(VoteChoice.No);
        var bobDto = ok.Value.Participants.Single(p => p.Id == bob.Id);
        bobDto.Votes.ShouldHaveSingleItem();
        bobDto.Votes[0].Choice.ShouldBe(VoteChoice.Maybe);
    }

    [Fact]
    public async Task WithSingleDateEvent_TreatsLoneDateAsChosen()
    {
        // Arrange
        await using var db = TestDb.Create();
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = organizerId, DisplayName = "Organizer A", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var token = await SeedEventAsync(db, organizerId,
            title: "Announcement Test",
            dateOptions: [DateTimeOffset.UtcNow.AddDays(10)]);
        var dateOption = await db.DateOptions.Include(d => d.Event).SingleAsync(d => d.Event!.Token == token);

        // Act
        var result = await GetEventByTokenHandler.Handle(token, null, db, CancellationToken.None);

        // Assert
        var ok = result.ShouldBeOfType<Ok<EventDetailResponse>>();
        ok.Value!.ChosenDateOptionId.ShouldBe(dateOption.Id);
    }

    [Fact]
    public async Task WithSingleDateEvent_YesCountHasNoImplicitOrganizerVote()
    {
        // Arrange
        await using var db = TestDb.Create();
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = organizerId, DisplayName = "Organizer A", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var token = await SeedEventAsync(db, organizerId,
            title: "Announcement Yes Count Test",
            dateOptions: [DateTimeOffset.UtcNow.AddDays(10)]);

        // Act
        var result = await GetEventByTokenHandler.Handle(token, null, db, CancellationToken.None);

        // Assert
        var ok = result.ShouldBeOfType<Ok<EventDetailResponse>>();
        ok.Value!.DateOptions.ShouldHaveSingleItem();
        ok.Value.DateOptions[0].YesCount.ShouldBe(0);
        ok.Value.DateOptions[0].NoCount.ShouldBe(0);
    }

    [Fact]
    public async Task WithMultipleDates_YesCountDoesNotIncludeOrganizer()
    {
        // Arrange
        await using var db = TestDb.Create();
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = organizerId, DisplayName = "Organizer A", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var token = await SeedEventAsync(db, organizerId,
            title: "Multi Date Yes Count Test",
            dateOptions: [DateTimeOffset.UtcNow.AddDays(10), DateTimeOffset.UtcNow.AddDays(11)]);

        // Act
        var result = await GetEventByTokenHandler.Handle(token, null, db, CancellationToken.None);

        // Assert
        var ok = result.ShouldBeOfType<Ok<EventDetailResponse>>();
        ok.Value!.DateOptions.ShouldAllBe(d => d.YesCount == 0);
    }

    [Fact]
    public async Task WithMultipleDatesAndNoLock_ChosenDateOptionIdIsNull()
    {
        // Arrange
        await using var db = TestDb.Create();
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = organizerId, DisplayName = "Organizer A", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var token = await SeedEventAsync(db, organizerId,
            title: "Multi Date Test",
            dateOptions: [DateTimeOffset.UtcNow.AddDays(10), DateTimeOffset.UtcNow.AddDays(11)]);

        // Act
        var result = await GetEventByTokenHandler.Handle(token, null, db, CancellationToken.None);

        // Assert
        var ok = result.ShouldBeOfType<Ok<EventDetailResponse>>();
        ok.Value!.ChosenDateOptionId.ShouldBeNull();
    }

    [Fact]
    public async Task WithParticipantId_ReturnsYou()
    {
        // Arrange
        await using var db = TestDb.Create();
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = organizerId, DisplayName = "Organizer A", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var token = await SeedEventAsync(db, organizerId,
            title: "You Test",
            dateOptions: [DateTimeOffset.UtcNow.AddDays(10)]);

        var @event = await db.Events.Include(e => e.DateOptions).SingleAsync(e => e.Token == token);
        var dateOption = @event.DateOptions.Single();
        var alice = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = @event.Id,
            DisplayName = "Alice",
            Attendance = AttendanceStatus.Coming,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Participants.Add(alice);
        db.DateVotes.Add(new DateVote { Id = Guid.CreateVersion7(), ParticipantId = alice.Id, DateOptionId = dateOption.Id, Choice = VoteChoice.Yes });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        // Act
        var result = await GetEventByTokenHandler.Handle(token, alice.Id, db, CancellationToken.None);

        // Assert
        var ok = result.ShouldBeOfType<Ok<EventDetailResponse>>();
        ok.Value!.You.ShouldNotBeNull();
        ok.Value.You!.Attendance.ShouldBe(AttendanceStatus.Coming);
        ok.Value.You.Votes.ShouldHaveSingleItem();
        ok.Value.You.Votes[0].Choice.ShouldBe(VoteChoice.Yes);
    }

    [Fact]
    public async Task WithUnknownParticipantId_ReturnsNullYou()
    {
        // Arrange
        await using var db = TestDb.Create();
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = organizerId, DisplayName = "Organizer A", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var token = await SeedEventAsync(db, organizerId, title: "No You Test");

        // Act
        var result = await GetEventByTokenHandler.Handle(token, Guid.NewGuid(), db, CancellationToken.None);

        // Assert
        var ok = result.ShouldBeOfType<Ok<EventDetailResponse>>();
        ok.Value!.You.ShouldBeNull();
    }

    private static async Task<string> SeedEventAsync(
        PicnivoDbContext db,
        Guid organizerId,
        string title,
        string? description = null,
        string? location = null,
        DateTimeOffset[]? dateOptions = null,
        string[]? items = null,
        string token = "testtoken01")
    {
        db.Events.Add(new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = title,
            Description = description,
            Location = location,
            Token = token,
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions = (dateOptions ?? [DateTimeOffset.UtcNow.AddDays(7)])
                .Select(d => new DateOption { Id = Guid.CreateVersion7(), StartsAt = d })
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
