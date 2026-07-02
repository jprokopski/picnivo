using Picnivo.API.Features.Events.CreateEvent;

namespace Picnivo.Tests.Features.Events.CreateEvent;

public class ShareTokenGeneratorTests
{
    private const string Base62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    [Fact]
    public void Generate_DefaultLength_Returns10Chars()
    {
        // Act
        var token = ShareTokenGenerator.Generate();

        // Assert
        token.Length.ShouldBe(10);
    }

    [Fact]
    public void Generate_CustomLength_ReturnsRequestedLength()
    {
        // Act
        var eightChar = ShareTokenGenerator.Generate(8);
        var elevenChar = ShareTokenGenerator.Generate(11);

        // Assert
        eightChar.Length.ShouldBe(8);
        elevenChar.Length.ShouldBe(11);
    }

    [Fact]
    public void Generate_InvalidLength_Throws()
    {
        // Act & Assert
        Should.Throw<ArgumentOutOfRangeException>(() => ShareTokenGenerator.Generate(0));
    }

    [Fact]
    public void Generate_AllCharsAreUrlSafeBase62()
    {
        for (var i = 0; i < 100; i++)
        {
            // Act
            var token = ShareTokenGenerator.Generate();

            // Assert
            token.ShouldAllBe(c => Base62.Contains(c));
        }
    }

    [Fact]
    public void Generate_AcrossManyCalls_ProducesUniqueTokens()
    {
        // Act
        var tokens = Enumerable.Range(0, 200).Select(_ => ShareTokenGenerator.Generate()).ToList();

        // Assert
        tokens.Distinct().Count().ShouldBe(tokens.Count);
    }
}
