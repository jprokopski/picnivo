using SetAttendanceHandler = Picnivo.API.Features.Participants.SetAttendance.SetAttendance;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.API.Features.Participants.SetAttendance;

namespace Picnivo.Tests.Features.Participants.SetAttendance;

public class SetAttendanceHandlerTests
{
    [Fact]
    public async Task WithComing_SetsAttendance()
    {
        // Arrange
        await using var db = TestDb.Create();
        var (token, participantId, _) = await SeedEventWithParticipantAsync(db);

        // Act
        var result = await SetAttendanceHandler.Handle(
            token, participantId, new SetAttendanceRequest(AttendanceStatus.Coming), db, CancellationToken.None);

        // Assert
        result.ShouldBeOfType<NoContent>();
        var participant = await db.Participants.SingleAsync(p => p.Id == participantId);
        participant.Attendance.ShouldBe(AttendanceStatus.Coming);
    }

    [Fact]
    public async Task WithOut_ReleasesAndOrphansClaims()
    {
        // Arrange
        await using var db = TestDb.Create();
        var (token, participantId, itemId) = await SeedEventWithParticipantAsync(db);
        db.ItemClaims.Add(new ItemClaim
        {
            Id = Guid.CreateVersion7(),
            EventItemId = itemId,
            ParticipantId = participantId,
            ClaimedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        // Act
        var result = await SetAttendanceHandler.Handle(
            token, participantId, new SetAttendanceRequest(AttendanceStatus.Out), db, CancellationToken.None);

        // Assert
        result.ShouldBeOfType<NoContent>();
        var participant = await db.Participants.SingleAsync(p => p.Id == participantId);
        participant.Attendance.ShouldBe(AttendanceStatus.Out);
        (await db.ItemClaims.AnyAsync(c => c.ParticipantId == participantId)).ShouldBeFalse();
        var item = await db.EventItems.SingleAsync(i => i.Id == itemId);
        item.OrphanedFromParticipantId.ShouldBe(participantId);
    }

    [Fact]
    public async Task WithNoClaims_GoingOutDoesNotOrphanAnything()
    {
        // Arrange
        await using var db = TestDb.Create();
        var (token, participantId, itemId) = await SeedEventWithParticipantAsync(db);

        // Act
        var result = await SetAttendanceHandler.Handle(
            token, participantId, new SetAttendanceRequest(AttendanceStatus.Out), db, CancellationToken.None);

        // Assert
        result.ShouldBeOfType<NoContent>();
        var item = await db.EventItems.SingleAsync(i => i.Id == itemId);
        item.OrphanedFromParticipantId.ShouldBeNull();
    }

    [Fact]
    public async Task WithUnknownParticipant_ReturnsNotFound()
    {
        // Arrange
        await using var db = TestDb.Create();
        var (token, _, _) = await SeedEventWithParticipantAsync(db);

        // Act
        var result = await SetAttendanceHandler.Handle(
            token, Guid.NewGuid(), new SetAttendanceRequest(AttendanceStatus.Coming), db, CancellationToken.None);

        // Assert
        result.ShouldBeOfType<NotFound>();
    }

    [Fact]
    public async Task WithUnknownToken_ReturnsNotFound()
    {
        // Arrange
        await using var db = TestDb.Create();

        // Act
        var result = await SetAttendanceHandler.Handle(
            "unknowntoken", Guid.NewGuid(), new SetAttendanceRequest(AttendanceStatus.Coming), db, CancellationToken.None);

        // Assert
        result.ShouldBeOfType<NotFound>();
    }

    private static async Task<(string Token, Guid ParticipantId, Guid ItemId)> SeedEventWithParticipantAsync(
        PicnivoDbContext db, string token = "testtoken01")
    {
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = organizerId, DisplayName = "Organizer", CreatedAt = DateTimeOffset.UtcNow });

        var item = new EventItem { Id = Guid.CreateVersion7(), Label = "Sandwiches" };
        var @event = new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = "Test Picnic",
            Token = token,
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions = [new DateOption { Id = Guid.CreateVersion7(), StartsAt = DateTimeOffset.UtcNow.AddDays(7) }],
            Items = [item]
        };
        db.Events.Add(@event);

        var participant = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = @event.Id,
            DisplayName = "Alice",
            Attendance = AttendanceStatus.Undecided,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Participants.Add(participant);

        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return (token, participant.Id, item.Id);
    }
}
