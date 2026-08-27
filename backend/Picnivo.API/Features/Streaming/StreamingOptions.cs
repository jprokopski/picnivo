namespace Picnivo.API.Features.Streaming;

public sealed class StreamingOptions
{
    public const string SectionName = "Streaming";

    public bool Enabled { get; set; } = true;
}
