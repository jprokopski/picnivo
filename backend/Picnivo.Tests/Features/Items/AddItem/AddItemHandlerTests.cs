using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.API.Features.Items.AddItem;
using Picnivo.API.Features.Streaming;
using AddItemHandler = Picnivo.API.Features.Items.AddItem.AddItem;

namespace Picnivo.Tests.Features.Items.AddItem;

public class AddItemHandlerTests
{
    [Fact]
    public async Task WithValidLabel_StampsAdderAndCreatesItem()
    {
        // Arrange
        await using var db = TestDb.Create();
        var broker = new EventStreamBroker();
        var (token, participantId) = await SeedEventWithParticipantAsync(db);

        // Act
        var result = await AddItemHandler.Handle(
            token,
            new AddItemRequest(participantId, "Drinks"),
            db,
            broker,
            CancellationToken.None
        );

        // Assert
        var created = result.ShouldBeOfType<Created<AddItemResponse>>();
        var item = await db.EventItems.SingleAsync(i => i.Id == created.Value!.Id);
        item.Label.ShouldBe("Drinks");
        item.AddedByParticipantId.ShouldBe(participantId);
    }

    [Fact]
    public async Task WithDuplicateLabel_ReturnsConflict()
    {
        // Arrange
        await using var db = TestDb.Create();
        var broker = new EventStreamBroker();
        var (token, participantId) = await SeedEventWithParticipantAsync(db);
        await AddItemHandler.Handle(
            token,
            new AddItemRequest(participantId, "Drinks"),
            db,
            broker,
            CancellationToken.None
        );
        db.ChangeTracker.Clear();

        // Act
        var result = await AddItemHandler.Handle(
            token,
            new AddItemRequest(participantId, "drinks"),
            db,
            broker,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<Conflict>();
        (await db.EventItems.CountAsync()).ShouldBe(1);
    }

    [Fact]
    public async Task AtCap_ReturnsBadRequest()
    {
        // Arrange
        await using var db = TestDb.Create();
        var broker = new EventStreamBroker();
        var (token, participantId) = await SeedEventWithParticipantAsync(db, existingItemCount: 50);

        // Act
        var result = await AddItemHandler.Handle(
            token,
            new AddItemRequest(participantId, "One More"),
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
        var (token, _) = await SeedEventWithParticipantAsync(db);

        // Act
        var result = await AddItemHandler.Handle(
            token,
            new AddItemRequest(Guid.NewGuid(), "Drinks"),
            db,
            broker,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<NotFound>();
    }

    private static async Task<(string Token, Guid ParticipantId)> SeedEventWithParticipantAsync(
        PicnivoDbContext db,
        int existingItemCount = 0,
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

        var items = Enumerable
            .Range(1, existingItemCount)
            .Select(i => new EventItem { Id = Guid.CreateVersion7(), Label = $"Item {i}" })
            .ToList();

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
            Items = items,
        };
        db.Events.Add(@event);

        var participant = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = @event.Id,
            DisplayName = "Alice",
            Attendance = AttendanceStatus.Coming,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Participants.Add(participant);

        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return (token, participant.Id);
    }
}
