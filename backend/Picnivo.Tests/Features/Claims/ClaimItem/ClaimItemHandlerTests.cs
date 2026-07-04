using EntityFramework.Exceptions.Common;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using ClaimItemHandler = Picnivo.API.Features.Claims.ClaimItem.ClaimItem;

namespace Picnivo.Tests.Features.Claims.ClaimItem;

// Eligibility matrix (server-enforced, ClaimItem.cs:57-79):
//   Coming                          -> allowed   (WhenAttendanceComing_AllowsClaim)
//   Undecided + Yes on chosen date  -> allowed   (WhenVotedYesOnChosenDate_AllowsClaim)
//   single-date event, Coming       -> allowed   (WithSingleDateEvent_AllowsClaimAfterConfirm)
//   Undecided, no Yes vote          -> forbidden (WhenNotComingAndNoYesVote_ReturnsForbidden)
//   Yes vote, then Out              -> forbidden (WhenVotedYesButAttendanceOut_ReturnsForbidden)
//   multi-date, no chosen date      -> forbidden (WhenMultiDateAndNoChosenDate_ReturnsForbidden)
public class ClaimItemHandlerTests
{
    [Fact]
    public async Task WhenNotComingAndNoYesVote_ReturnsForbidden()
    {
        // Arrange
        await using var db = TestDb.Create();
        var (token, participantId, itemId, _, _) = await SeedEventAsync(db, dateOptionCount: 1);

        // Act
        var result = await ClaimItemHandler.Handle(
            token,
            itemId,
            participantId,
            db,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<StatusCodeHttpResult>().StatusCode.ShouldBe(403);
    }

    [Fact]
    public async Task WhenAttendanceComing_AllowsClaim()
    {
        // Arrange
        await using var db = TestDb.Create();
        var (token, participantId, itemId, _, _) = await SeedEventAsync(
            db,
            dateOptionCount: 1,
            attendance: AttendanceStatus.Coming
        );

        // Act
        var result = await ClaimItemHandler.Handle(
            token,
            itemId,
            participantId,
            db,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<NoContent>();
        var claim = await db.ItemClaims.SingleAsync(c => c.EventItemId == itemId);
        claim.ParticipantId.ShouldBe(participantId);
    }

    [Fact]
    public async Task WhenMultiDateAndNoChosenDate_ReturnsForbidden()
    {
        // Arrange
        await using var db = TestDb.Create();
        var (token, participantId, itemId, _, _) = await SeedEventAsync(
            db,
            dateOptionCount: 2,
            attendance: AttendanceStatus.Coming
        );

        // Act
        var result = await ClaimItemHandler.Handle(
            token,
            itemId,
            participantId,
            db,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<StatusCodeHttpResult>().StatusCode.ShouldBe(403);
    }

    [Fact]
    public async Task WhenVotedYesOnChosenDate_AllowsClaim()
    {
        // Arrange
        await using var db = TestDb.Create();
        var (token, participantId, itemId, eventId, dateOptionIds) = await SeedEventAsync(
            db,
            dateOptionCount: 2
        );
        var chosenDateOptionId = dateOptionIds[0];
        var @event = await db.Events.SingleAsync(e => e.Id == eventId);
        @event.ChosenDateOptionId = chosenDateOptionId;
        db.DateVotes.Add(
            new DateVote
            {
                Id = Guid.CreateVersion7(),
                ParticipantId = participantId,
                DateOptionId = chosenDateOptionId,
                Choice = VoteChoice.Yes,
            }
        );
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        // Act
        var result = await ClaimItemHandler.Handle(
            token,
            itemId,
            participantId,
            db,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<NoContent>();
    }

    [Fact]
    public async Task WhenVotedYesButAttendanceOut_ReturnsForbidden()
    {
        // Arrange
        await using var db = TestDb.Create();
        var (token, participantId, itemId, eventId, dateOptionIds) = await SeedEventAsync(
            db,
            dateOptionCount: 2,
            attendance: AttendanceStatus.Out
        );
        var chosenDateOptionId = dateOptionIds[0];
        var @event = await db.Events.SingleAsync(e => e.Id == eventId);
        @event.ChosenDateOptionId = chosenDateOptionId;
        db.DateVotes.Add(
            new DateVote
            {
                Id = Guid.CreateVersion7(),
                ParticipantId = participantId,
                DateOptionId = chosenDateOptionId,
                Choice = VoteChoice.Yes,
            }
        );
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        // Act
        var result = await ClaimItemHandler.Handle(
            token,
            itemId,
            participantId,
            db,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<StatusCodeHttpResult>().StatusCode.ShouldBe(403);
    }

    [Fact]
    public async Task WithSingleDateEvent_AllowsClaimAfterConfirm()
    {
        // Arrange
        await using var db = TestDb.Create();
        var (token, participantId, itemId, _, _) = await SeedEventAsync(
            db,
            dateOptionCount: 1,
            attendance: AttendanceStatus.Coming
        );

        // Act
        var result = await ClaimItemHandler.Handle(
            token,
            itemId,
            participantId,
            db,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<NoContent>();
    }

    [Fact]
    public async Task ClaimingClearsOrphanStamp()
    {
        // Arrange
        await using var db = TestDb.Create();
        var (token, participantId, itemId, eventId, _) = await SeedEventAsync(
            db,
            dateOptionCount: 1,
            attendance: AttendanceStatus.Coming
        );
        var priorHolder = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = eventId,
            DisplayName = "Bob",
            Attendance = AttendanceStatus.Out,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Participants.Add(priorHolder);
        var item = await db.EventItems.SingleAsync(i => i.Id == itemId);
        item.OrphanedFromParticipantId = priorHolder.Id;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        // Act
        var result = await ClaimItemHandler.Handle(
            token,
            itemId,
            participantId,
            db,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<NoContent>();
        var updated = await db.EventItems.SingleAsync(i => i.Id == itemId);
        updated.OrphanedFromParticipantId.ShouldBeNull();
    }

    [Fact]
    public async Task WhenAlreadyClaimed_ThrowsUniqueConstraintException()
    {
        // Arrange
        await using var db = TestDb.Create();
        var (token, participantId, itemId, eventId, _) = await SeedEventAsync(
            db,
            dateOptionCount: 1,
            attendance: AttendanceStatus.Coming
        );
        db.ItemClaims.Add(
            new ItemClaim
            {
                Id = Guid.CreateVersion7(),
                EventItemId = itemId,
                ParticipantId = participantId,
                ClaimedAt = DateTimeOffset.UtcNow,
            }
        );
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var otherParticipant = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = eventId,
            DisplayName = "Bob",
            Attendance = AttendanceStatus.Coming,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Participants.Add(otherParticipant);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        // Act & Assert
        await Should.ThrowAsync<UniqueConstraintException>(() =>
            ClaimItemHandler.Handle(token, itemId, otherParticipant.Id, db, CancellationToken.None)
        );
    }

    [Fact]
    public async Task WithUnknownItem_ReturnsNotFound()
    {
        // Arrange
        await using var db = TestDb.Create();
        var (token, participantId, _, _, _) = await SeedEventAsync(
            db,
            dateOptionCount: 1,
            attendance: AttendanceStatus.Coming
        );

        // Act
        var result = await ClaimItemHandler.Handle(
            token,
            Guid.NewGuid(),
            participantId,
            db,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<NotFound>();
    }

    private static async Task<(
        string Token,
        Guid ParticipantId,
        Guid ItemId,
        Guid EventId,
        List<Guid> DateOptionIds
    )> SeedEventAsync(
        PicnivoDbContext db,
        int dateOptionCount,
        AttendanceStatus attendance = AttendanceStatus.Undecided,
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
        var item = new EventItem { Id = Guid.CreateVersion7(), Label = "Sandwiches" };

        var @event = new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = "Test Picnic",
            Token = token,
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions = dateOptions,
            Items = [item],
        };
        db.Events.Add(@event);

        var participant = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = @event.Id,
            DisplayName = "Alice",
            Attendance = attendance,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Participants.Add(participant);

        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return (token, participant.Id, item.Id, @event.Id, dateOptions.Select(d => d.Id).ToList());
    }
}
