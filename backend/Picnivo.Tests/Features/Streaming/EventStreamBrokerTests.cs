using Picnivo.API.Features.Streaming;

namespace Picnivo.Tests.Features.Streaming;

public class EventStreamBrokerTests
{
    [Fact]
    public async Task Subscribe_ReceivesPublishedRevision()
    {
        // Arrange
        var broker = new EventStreamBroker();
        using var cts = new CancellationTokenSource();
        var enumerator = broker.Subscribe("token-a", cts.Token).GetAsyncEnumerator(cts.Token);

        // Act
        var published = broker.Publish("token-a");
        await enumerator.MoveNextAsync();

        // Assert
        enumerator.Current.ShouldBe(published);
    }

    [Fact]
    public void Publish_RevisionsStrictlyIncrease()
    {
        // Arrange
        var broker = new EventStreamBroker();

        // Act
        var first = broker.Publish("token-a");
        var second = broker.Publish("token-a");
        var third = broker.Publish("token-a");

        // Assert
        second.ShouldBeGreaterThan(first);
        third.ShouldBeGreaterThan(second);
    }

    [Fact]
    public void Publish_TokensAreIsolated()
    {
        // Arrange
        var broker = new EventStreamBroker();

        // Act
        var revisionA1 = broker.Publish("token-a");
        var revisionB1 = broker.Publish("token-b");
        var revisionA2 = broker.Publish("token-a");

        // Assert: publishing to token-b never advances token-a's counter, and vice versa.
        revisionA2.ShouldBeGreaterThan(revisionA1);
        broker.CurrentRevision("token-a").ShouldBe(revisionA2);
        broker.CurrentRevision("token-b").ShouldBe(revisionB1);
    }

    [Fact]
    public async Task Subscribe_CancellationCompletesEnumerationWithoutHanging()
    {
        // Arrange
        var broker = new EventStreamBroker();
        using var cts = new CancellationTokenSource();
        var enumerator = broker.Subscribe("token-a", cts.Token).GetAsyncEnumerator(cts.Token);

        // Act
        cts.Cancel();

        // Assert
        await Should.ThrowAsync<OperationCanceledException>(async () =>
            await enumerator.MoveNextAsync()
        );
    }

    [Fact]
    public void CurrentRevision_SeedsFromWallClockTime()
    {
        // Arrange
        var broker = new EventStreamBroker();
        var before = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        // Act
        var revision = broker.CurrentRevision("fresh-token");

        // Assert
        revision.ShouldBeGreaterThanOrEqualTo(before);
    }
}
