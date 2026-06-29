using Picnivo.API.Features.Events.CreateEvent;

namespace Picnivo.Tests.Features.Events.CreateEvent;

public class CreateEventValidatorTests
{
    private readonly CreateEventValidator _validator = new();

    [Fact]
    public async Task WithEmptyTitle_IsInvalid()
    {
        // Arrange
        var request = ValidRequest() with { Title = "   " };

        // Act
        var result = await _validator.ValidateAsync(request);

        // Assert
        result.IsValid.ShouldBeFalse();
    }

    [Fact]
    public async Task WithZeroDateOptions_IsInvalid()
    {
        // Arrange
        var request = ValidRequest() with { DateOptions = [] };

        // Act
        var result = await _validator.ValidateAsync(request);

        // Assert
        result.IsValid.ShouldBeFalse();
    }

    [Fact]
    public async Task WithElevenDateOptions_IsInvalid()
    {
        // Arrange
        var request = ValidRequest(11);

        // Act
        var result = await _validator.ValidateAsync(request);

        // Assert
        result.IsValid.ShouldBeFalse();
    }

    [Fact]
    public async Task WithPastDateOption_IsInvalid()
    {
        // Arrange
        var request = ValidRequest() with { DateOptions = [DateTimeOffset.UtcNow.AddDays(-1)] };

        // Act
        var result = await _validator.ValidateAsync(request);

        // Assert
        result.IsValid.ShouldBeFalse();
    }

    [Fact]
    public async Task WithValidData_IsValid()
    {
        // Arrange
        var request = ValidRequest();

        // Act
        var result = await _validator.ValidateAsync(request);

        // Assert
        result.IsValid.ShouldBeTrue();
    }

    private static CreateEventRequest ValidRequest(int dateCount = 2) => new(
        Title: "Test Picnic",
        Description: null,
        Location: null,
        DateOptions: Enumerable.Range(1, dateCount)
            .Select(i => DateTimeOffset.UtcNow.AddDays(7 + i))
            .ToArray(),
        Items: []);
}
