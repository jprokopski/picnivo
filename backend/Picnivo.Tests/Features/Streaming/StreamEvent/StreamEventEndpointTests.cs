using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.API.Features.Streaming;

namespace Picnivo.Tests.Features.Streaming.StreamEvent;

[Collection("Api")]
public class StreamEventEndpointTests(ApiFixture fixture)
{
    [Fact]
    public async Task WithUnknownToken_Returns404()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();

        // Act
        var response = await ctx.Client.GetAsync("/api/events/unknowntokenxyz/stream");

        // Assert
        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Connect_EmitsInitialRevisionThenChangedEventOnPublish()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var organizerId = await ArrangeOrganizerAsync(ctx.Services);
        var token = await SeedEventAsync(ctx.Services, organizerId);
        var broker = ctx.Services.GetRequiredService<IEventStreamBroker>();

        using var connectCts = new CancellationTokenSource(TimeSpan.FromSeconds(20));
        using var response = await ctx.Client.GetAsync(
            $"/api/events/{token}/stream",
            HttpCompletionOption.ResponseHeadersRead,
            connectCts.Token
        );
        response.StatusCode.ShouldBe(HttpStatusCode.OK);

        await using var stream = await response.Content.ReadAsStreamAsync(connectCts.Token);
        using var reader = new StreamReader(stream);

        // Act
        var initialData = await ReadNextEventDataAsync(reader, connectCts.Token);
        var published = broker.Publish(token);
        var nextData = await ReadNextEventDataAsync(reader, connectCts.Token);

        // Assert
        initialData.ShouldNotBeNull();
        nextData.ShouldBe(published.ToString());

        // The in-memory TestServer doesn't propagate client-side stream disposal to the
        // server's HttpContext.RequestAborted, so the SSE loop must be cancelled explicitly
        // or it keeps running in the background for the lifetime of the test process.
        await connectCts.CancelAsync();
    }

    private static async Task<string?> ReadNextEventDataAsync(
        StreamReader reader,
        CancellationToken ct
    )
    {
        string? data = null;
        while (!ct.IsCancellationRequested)
        {
            var line = await reader.ReadLineAsync(ct);
            if (line is null)
            {
                return data;
            }

            if (line.StartsWith("data:", StringComparison.Ordinal))
            {
                data = line["data:".Length..].Trim();
            }
            else if (line.Length == 0 && data is not null)
            {
                return data;
            }
        }

        return data;
    }

    private static async Task<Guid> ArrangeOrganizerAsync(IServiceProvider services)
    {
        var id = Guid.NewGuid();
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        db.Organizers.Add(
            new Organizer
            {
                Id = id,
                DisplayName = "Test Organizer",
                CreatedAt = DateTimeOffset.UtcNow,
            }
        );
        await db.SaveChangesAsync();
        return id;
    }

    private static async Task<string> SeedEventAsync(IServiceProvider services, Guid organizerId)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();

        var @event = new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = "Test Picnic",
            Token = "testtoken01",
            CreatedAt = DateTimeOffset.UtcNow,
        };

        db.Events.Add(@event);
        await db.SaveChangesAsync();
        return @event.Token;
    }
}
