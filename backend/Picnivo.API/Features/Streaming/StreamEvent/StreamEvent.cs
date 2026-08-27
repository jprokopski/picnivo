using System.Net.ServerSentEvents;
using System.Runtime.CompilerServices;
using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Picnivo.API.Data;

namespace Picnivo.API.Features.Streaming.StreamEvent;

public static class StreamEvent
{
    private static readonly TimeSpan HeartbeatInterval = TimeSpan.FromSeconds(20);

    public static async Task<IResult> Handle(
        string token,
        PicnivoDbContext db,
        IEventStreamBroker broker,
        IOptions<StreamingOptions> streamingOptions,
        CancellationToken ct
    )
    {
        if (!streamingOptions.Value.Enabled)
        {
            return Results.NotFound();
        }

        var exists = await db.Events.AnyAsync(e => e.Token == token, ct);
        if (!exists)
        {
            return Results.NotFound();
        }

        return TypedResults.ServerSentEvents(Stream(token, broker, ct));
    }

    // Subscribes before yielding anything, so the subscription is guaranteed registered
    // before the client can observe the baseline revision and race ahead with a publish.
    private static async IAsyncEnumerable<SseItem<long>> Stream(
        string token,
        IEventStreamBroker broker,
        [EnumeratorCancellation] CancellationToken ct
    )
    {
        var channel = Channel.CreateUnbounded<SseItem<long>>();

        var pump = Task.WhenAll(
            PumpChangesAsync(broker.Subscribe(token, ct), channel.Writer, ct),
            PumpHeartbeatsAsync(channel.Writer, ct)
        );
        _ = pump.ContinueWith(_ => channel.Writer.TryComplete(), TaskScheduler.Default);

        var initialRevision = broker.CurrentRevision(token);
        yield return new SseItem<long>(initialRevision, "changed")
        {
            EventId = initialRevision.ToString(),
        };

        await foreach (var item in channel.Reader.ReadAllAsync(ct))
        {
            yield return item;
        }
    }

    private static async Task PumpChangesAsync(
        IAsyncEnumerable<long> changes,
        ChannelWriter<SseItem<long>> writer,
        CancellationToken ct
    )
    {
        try
        {
            await foreach (var revision in changes)
            {
                await writer.WriteAsync(
                    new SseItem<long>(revision, "changed") { EventId = revision.ToString() },
                    ct
                );
            }
        }
        catch (OperationCanceledException) { }
    }

    private static async Task PumpHeartbeatsAsync(
        ChannelWriter<SseItem<long>> writer,
        CancellationToken ct
    )
    {
        try
        {
            while (true)
            {
                await Task.Delay(HeartbeatInterval, ct);
                await writer.WriteAsync(new SseItem<long>(0, "heartbeat"), ct);
            }
        }
        catch (OperationCanceledException) { }
    }
}
