namespace Picnivo.API.Features.Streaming;

public interface IEventStreamBroker
{
    long CurrentRevision(string token);

    long Publish(string token);

    IAsyncEnumerable<long> Subscribe(string token, CancellationToken ct);
}
