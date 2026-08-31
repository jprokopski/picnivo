using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using System.Threading.Channels;

namespace Picnivo.API.Features.Streaming;

public sealed class EventStreamBroker : IEventStreamBroker
{
    private readonly ConcurrentDictionary<string, TokenState> _tokens = new();

    public long CurrentRevision(string token) =>
        _tokens.GetOrAdd(token, _ => new TokenState()).Revision;

    public long Publish(string token)
    {
        var state = _tokens.GetOrAdd(token, _ => new TokenState());
        var revision = state.NextRevision();

        foreach (var (_, channel) in state.Subscribers)
        {
            channel.Writer.TryWrite(revision);
        }

        return revision;
    }

    public IAsyncEnumerable<long> Subscribe(string token, CancellationToken ct)
    {
        var state = _tokens.GetOrAdd(token, _ => new TokenState());
        var subscriberId = Guid.NewGuid();
        var channel = Channel.CreateBounded<long>(
            new BoundedChannelOptions(1)
            {
                FullMode = BoundedChannelFullMode.DropOldest,
                SingleReader = true,
                SingleWriter = false,
            }
        );
        state.Subscribers[subscriberId] = channel;

        return ReadAsync(token, state, subscriberId, channel, ct);
    }

    private async IAsyncEnumerable<long> ReadAsync(
        string token,
        TokenState state,
        Guid subscriberId,
        Channel<long> channel,
        [EnumeratorCancellation] CancellationToken ct
    )
    {
        try
        {
            await foreach (var revision in channel.Reader.ReadAllAsync(ct))
            {
                yield return revision;
            }
        }
        finally
        {
            state.Subscribers.TryRemove(subscriberId, out _);
            if (state.Subscribers.IsEmpty)
            {
                _tokens.TryRemove(new KeyValuePair<string, TokenState>(token, state));
            }
        }
    }

    private sealed class TokenState
    {
        private long _revision = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        public ConcurrentDictionary<Guid, Channel<long>> Subscribers { get; } = new();

        public long Revision => Interlocked.Read(ref _revision);

        public long NextRevision() => Interlocked.Increment(ref _revision);
    }
}
