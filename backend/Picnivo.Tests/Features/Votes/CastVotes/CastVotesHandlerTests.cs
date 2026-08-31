using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.API.Features.Streaming;
using Picnivo.API.Features.Votes.CastVotes;
using CastVotesHandler = Picnivo.API.Features.Votes.CastVotes.CastVotes;

namespace Picnivo.Tests.Features.Votes.CastVotes;

public class CastVotesHandlerTests
{
    [Fact]
    public async Task OnSuccess_PublishesRevision()
    {
        // Arrange
        await using var db = TestDb.Create();
        var broker = new EventStreamBroker();
        var (token, participantId, dateOptionId, _) = await SeedEventWithParticipantAsync(db);
        var before = broker.CurrentRevision(token);

        // Act
        await CastVotesHandler.Handle(
            token,
            participantId,
            new CastVotesRequest([new VoteDto(dateOptionId, VoteChoice.Yes)]),
            db,
            broker,
            CancellationToken.None
        );

        // Assert
        broker.CurrentRevision(token).ShouldBeGreaterThan(before);
    }

    [Fact]
    public async Task OnRejection_DoesNotPublish()
    {
        // Arrange
        await using var db = TestDb.Create();
        var broker = new EventStreamBroker();
        var (token, participantId, _, _) = await SeedEventWithParticipantAsync(db);
        var before = broker.CurrentRevision(token);

        // Act
        await CastVotesHandler.Handle(
            token,
            participantId,
            new CastVotesRequest([new VoteDto(Guid.NewGuid(), VoteChoice.Yes)]),
            db,
            broker,
            CancellationToken.None
        );

        // Assert
        broker.CurrentRevision(token).ShouldBe(before);
    }

    [Fact]
    public async Task UpsertsVote_ChangingChoiceWithoutAddingRows()
    {
        // Arrange
        await using var db = TestDb.Create();
        var broker = new EventStreamBroker();
        var (token, participantId, dateOptionId, _) = await SeedEventWithParticipantAsync(db);

        // Act
        await CastVotesHandler.Handle(
            token,
            participantId,
            new CastVotesRequest([new VoteDto(dateOptionId, VoteChoice.Yes)]),
            db,
            broker,
            CancellationToken.None
        );
        db.ChangeTracker.Clear();
        var result = await CastVotesHandler.Handle(
            token,
            participantId,
            new CastVotesRequest([new VoteDto(dateOptionId, VoteChoice.No)]),
            db,
            broker,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<NoContent>();
        var votes = await db.DateVotes.Where(v => v.ParticipantId == participantId).ToListAsync();
        votes.ShouldHaveSingleItem();
        votes[0].Choice.ShouldBe(VoteChoice.No);
    }

    [Fact]
    public async Task WithDateOptionNotBelongingToEvent_ReturnsBadRequest()
    {
        // Arrange
        await using var db = TestDb.Create();
        var broker = new EventStreamBroker();
        var (token, participantId, _, _) = await SeedEventWithParticipantAsync(db);

        // Act
        var result = await CastVotesHandler.Handle(
            token,
            participantId,
            new CastVotesRequest([new VoteDto(Guid.NewGuid(), VoteChoice.Yes)]),
            db,
            broker,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<BadRequest>();
    }

    [Fact]
    public async Task WithUnknownParticipant_ReturnsNotFound()
    {
        // Arrange
        await using var db = TestDb.Create();
        var broker = new EventStreamBroker();
        var (token, _, dateOptionId, _) = await SeedEventWithParticipantAsync(db);

        // Act
        var result = await CastVotesHandler.Handle(
            token,
            Guid.NewGuid(),
            new CastVotesRequest([new VoteDto(dateOptionId, VoteChoice.Yes)]),
            db,
            broker,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<NotFound>();
    }

    [Fact]
    public async Task WithSingleDateEvent_ReturnsBadRequest()
    {
        // Arrange
        await using var db = TestDb.Create();
        var broker = new EventStreamBroker();
        var (token, participantId, dateOptionId, _) = await SeedEventWithParticipantAsync(
            db,
            dateOptionCount: 1
        );

        // Act
        var result = await CastVotesHandler.Handle(
            token,
            participantId,
            new CastVotesRequest([new VoteDto(dateOptionId, VoteChoice.Yes)]),
            db,
            broker,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<BadRequest>();
    }

    private static async Task<(
        string Token,
        Guid ParticipantId,
        Guid DateOptionId,
        Guid EventId
    )> SeedEventWithParticipantAsync(
        PicnivoDbContext db,
        int dateOptionCount = 2,
        string token = "testtoken01"
    )
    {
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(
            new Organizer
            {
                Id = organizerId,
                DisplayName = "Organizer",
                CreatedAt = DateTimeOffset.UtcNow,
            }
        );

        var dateOptions = Enumerable
            .Range(1, dateOptionCount)
            .Select(i => new DateOption
            {
                Id = Guid.CreateVersion7(),
                StartsAt = DateTimeOffset.UtcNow.AddDays(7 + i),
            })
            .ToList();

        var @event = new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = "Test Picnic",
            Token = token,
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions = dateOptions,
        };
        db.Events.Add(@event);

        var participant = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = @event.Id,
            DisplayName = "Alice",
            Attendance = AttendanceStatus.Undecided,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Participants.Add(participant);

        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return (token, participant.Id, dateOptions[0].Id, @event.Id);
    }
}
