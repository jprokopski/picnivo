using Picnivo.API.Features.Participants.JoinEvent;

namespace Picnivo.Tests.Features.Participants.JoinEvent;

public class JoinEventValidatorTests
{
    private readonly JoinEventValidator _validator = new();

    [Fact]
    public async Task WithEmptyName_IsInvalid()
    {
        // Arrange
        var request = new JoinEventRequest("   ");

        // Act
        var result = await _validator.ValidateAsync(request);

        // Assert
        result.IsValid.ShouldBeFalse();
    }

    [Fact]
    public async Task WithNameOver100Chars_IsInvalid()
    {
        // Arrange
        var request = new JoinEventRequest(new string('a', 101));

        // Act
        var result = await _validator.ValidateAsync(request);

        // Assert
        result.IsValid.ShouldBeFalse();
    }

    [Fact]
    public async Task WithValidName_IsValid()
    {
        // Arrange
        var request = new JoinEventRequest("Alice");

        // Act
        var result = await _validator.ValidateAsync(request);

        // Assert
        result.IsValid.ShouldBeTrue();
    }
}
