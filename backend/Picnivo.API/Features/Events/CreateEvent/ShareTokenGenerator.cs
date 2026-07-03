using System.Security.Cryptography;

namespace Picnivo.API.Features.Events.CreateEvent;

// Base62 alphabet: URL-safe, no padding, no ambiguous separators.
// Collision handling (retry on unique-constraint violation) lives at the insert site.
public static class ShareTokenGenerator
{
    private const string Alphabet =
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    private const int DefaultLength = 10;

    public static string Generate(int length = DefaultLength)
    {
        if (length <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(length), "Token length must be positive.");
        }

        var chars = new char[length];
        for (var i = 0; i < length; i++)
        {
            chars[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        }

        return new string(chars);
    }
}
