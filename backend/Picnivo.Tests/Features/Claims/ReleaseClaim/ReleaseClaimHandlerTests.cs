using ReleaseClaimHandler = Picnivo.API.Features.Claims.ReleaseClaim.ReleaseClaim;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;

namespace Picnivo.Tests.Features.Claims.ReleaseClaim;

public class ReleaseClaimHandlerTests
{
    [Fact]
    public async Task PlainRelease_RemovesClaimWithoutOrphaning()
    {
        // Arrange
        await using var db = TestDb.Create();
        var (token, participantId, itemId) = await SeedClaimedItemAsync(db);

        // Act
        var result = await ReleaseClaimHandler.Handle(token, itemId, participantId, db, CancellationToken.None);

        // Assert
        result.ShouldBeOfType<NoContent>();
        (await db.ItemClaims.AnyAsync(c => c.EventItemId == itemId)).ShouldBeFalse();
        var item = await db.EventItems.SingleAsync(i => i.Id == itemId);
        item.OrphanedFromParticipantId.ShouldBeNull();
    }

    [Fact]
    public async Task WithNoClaimByParticipant_ReturnsNotFound()
    {
        // Arrange
        await using var db = TestDb.Create();
        var (token, _, itemId) = await SeedClaimedItemAsync(db);

        // Act
        var result = await ReleaseClaimHandler.Handle(token, itemId, Guid.NewGuid(), db, CancellationToken.None);

        // Assert
        result.ShouldBeOfType<NotFound>();
    }

    [Fact]
    public async Task WithUnknownToken_ReturnsNotFound()
    {
        // Arrange
        await using var db = TestDb.Create();

        // Act
        var result = await ReleaseClaimHandler.Handle("unknowntoken", Guid.NewGuid(), Guid.NewGuid(), db, CancellationToken.None);

        // Assert
        result.ShouldBeOfType<NotFound>();
    }

    private static async Task<(string Token, Guid ParticipantId, Guid ItemId)> SeedClaimedItemAsync(
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
            Attendance = AttendanceStatus.Coming,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Participants.Add(participant);
        db.ItemClaims.Add(new ItemClaim
        {
            Id = Guid.CreateVersion7(),
            EventItemId = item.Id,
            ParticipantId = participant.Id,
            ClaimedAt = DateTimeOffset.UtcNow
        });

        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return (token, participant.Id, item.Id);
    }
}
