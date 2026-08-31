using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;
using Picnivo.API.Data.Models;
using Picnivo.API.Features.Streaming;
using StreamEventHandler = Picnivo.API.Features.Streaming.StreamEvent.StreamEvent;

namespace Picnivo.Tests.Features.Streaming.StreamEvent;

public class StreamEventHandlerTests
{
    [Fact]
    public async Task WithUnknownToken_ReturnsNotFound()
    {
        // Arrange
        await using var db = TestDb.Create();
        var broker = new EventStreamBroker();
        var options = Options.Create(new StreamingOptions { Enabled = true });

        // Act
        var result = await StreamEventHandler.Handle(
            "unknowntoken",
            db,
            broker,
            options,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<NotFound>();
    }

    [Fact]
    public async Task WhenStreamingDisabled_ReturnsNotFoundEvenForKnownToken()
    {
        // Arrange
        await using var db = TestDb.Create();
        var token = await SeedEventAsync(db);
        var broker = new EventStreamBroker();
        var options = Options.Create(new StreamingOptions { Enabled = false });

        // Act
        var result = await StreamEventHandler.Handle(
            token,
            db,
            broker,
            options,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<NotFound>();
    }

    [Fact]
    public async Task WithKnownTokenAndStreamingEnabled_ReturnsServerSentEventsResult()
    {
        // Arrange
        await using var db = TestDb.Create();
        var token = await SeedEventAsync(db);
        var broker = new EventStreamBroker();
        var options = Options.Create(new StreamingOptions { Enabled = true });

        // Act
        var result = await StreamEventHandler.Handle(
            token,
            db,
            broker,
            options,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<ServerSentEventsResult<long>>();
    }

    private static async Task<string> SeedEventAsync(Picnivo.API.Data.PicnivoDbContext db)
    {
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(
            new Organizer
            {
                Id = organizerId,
                DisplayName = "Organizer A",
                CreatedAt = DateTimeOffset.UtcNow,
            }
        );
        db.Events.Add(
            new Event
            {
                Id = Guid.CreateVersion7(),
                OrganizerId = organizerId,
                Title = "Test Picnic",
                Token = "testtoken01",
                CreatedAt = DateTimeOffset.UtcNow,
            }
        );
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return "testtoken01";
    }
}
