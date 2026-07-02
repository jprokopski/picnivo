using Picnivo.API.Data.Models;
using Picnivo.API.Features.Votes.CastVotes;

namespace Picnivo.Tests.Features.Votes.CastVotes;

public class CastVotesValidatorTests
{
    private readonly CastVotesValidator _validator = new();

    [Fact]
    public async Task WithNoVotes_IsInvalid()
    {
        // Arrange
        var request = new CastVotesRequest([]);

        // Act
        var result = await _validator.ValidateAsync(request);

        // Assert
        result.IsValid.ShouldBeFalse();
    }

    [Fact]
    public async Task WithInvalidChoice_IsInvalid()
    {
        // Arrange
        var request = new CastVotesRequest([new VoteDto(Guid.NewGuid(), (VoteChoice)99)]);

        // Act
        var result = await _validator.ValidateAsync(request);

        // Assert
        result.IsValid.ShouldBeFalse();
    }

    [Fact]
    public async Task WithValidVotes_IsValid()
    {
        // Arrange
        var request = new CastVotesRequest([new VoteDto(Guid.NewGuid(), VoteChoice.Yes)]);

        // Act
        var result = await _validator.ValidateAsync(request);

        // Assert
        result.IsValid.ShouldBeTrue();
    }
}
