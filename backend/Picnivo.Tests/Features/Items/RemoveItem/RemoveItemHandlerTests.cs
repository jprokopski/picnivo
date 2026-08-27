using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.API.Features.Streaming;
using RemoveItemHandler = Picnivo.API.Features.Items.RemoveItem.RemoveItem;

namespace Picnivo.Tests.Features.Items.RemoveItem;

public class RemoveItemHandlerTests
{
    [Fact]
    public async Task Adder_CanRemoveOwnItem()
    {
        // Arrange
        await using var db = TestDb.Create();
        var broker = new EventStreamBroker();
        var (token, itemId, participantId, _) = await SeedEventAsync(db);

        // Act
        var result = await RemoveItemHandler.Handle(
            token,
            itemId,
            participantId,
            AnonymousUser(),
            db,
            broker,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<NoContent>();
        (await db.EventItems.AnyAsync(i => i.Id == itemId)).ShouldBeFalse();
    }

    [Fact]
    public async Task Organizer_CanRemoveAnyItem()
    {
        // Arrange
        await using var db = TestDb.Create();
        var broker = new EventStreamBroker();
        var (token, itemId, _, organizerId) = await SeedEventAsync(db);

        // Act
        var result = await RemoveItemHandler.Handle(
            token,
            itemId,
            null,
            UserWith(organizerId),
            db,
            broker,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<NoContent>();
        (await db.EventItems.AnyAsync(i => i.Id == itemId)).ShouldBeFalse();
    }

    [Fact]
    public async Task NonAdderNonOrganizer_ReturnsForbidden()
    {
        // Arrange
        await using var db = TestDb.Create();
        var broker = new EventStreamBroker();
        var (token, itemId, _, _) = await SeedEventAsync(db);

        // Act
        var result = await RemoveItemHandler.Handle(
            token,
            itemId,
            Guid.NewGuid(),
            AnonymousUser(),
            db,
            broker,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<StatusCodeHttpResult>().StatusCode.ShouldBe(403);
    }

    [Fact]
    public async Task RemovingClaimedItem_CascadesClaim()
    {
        // Arrange
        await using var db = TestDb.Create();
        var broker = new EventStreamBroker();
        var (token, itemId, participantId, _) = await SeedEventAsync(db);
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

        // Act
        var result = await RemoveItemHandler.Handle(
            token,
            itemId,
            participantId,
            AnonymousUser(),
            db,
            broker,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<NoContent>();
        (await db.ItemClaims.AnyAsync(c => c.EventItemId == itemId)).ShouldBeFalse();
    }

    private static ClaimsPrincipal AnonymousUser() => new(new ClaimsIdentity());

    private static ClaimsPrincipal UserWith(Guid organizerId) =>
        new(new ClaimsIdentity([new Claim("sub", organizerId.ToString())]));

    private static async Task<(
        string Token,
        Guid ItemId,
        Guid ParticipantId,
        Guid OrganizerId
    )> SeedEventAsync(PicnivoDbContext db, string token = "testtoken01")
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

        var participant = new Participant
        {
            Id = Guid.CreateVersion7(),
            DisplayName = "Alice",
            Attendance = AttendanceStatus.Coming,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        var item = new EventItem
        {
            Id = Guid.CreateVersion7(),
            Label = "Sandwiches",
            AddedByParticipant = participant,
        };

        var @event = new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = "Test Picnic",
            Token = token,
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions =
            [
                new DateOption
                {
                    Id = Guid.CreateVersion7(),
                    StartsAt = DateTimeOffset.UtcNow.AddDays(7),
                },
            ],
            Items = [item],
            Participants = [participant],
        };
        db.Events.Add(@event);

        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return (token, item.Id, participant.Id, organizerId);
    }
}
