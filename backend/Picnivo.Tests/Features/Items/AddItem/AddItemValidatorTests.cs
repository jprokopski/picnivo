using FluentValidation.TestHelper;
using Picnivo.API.Features.Items.AddItem;

namespace Picnivo.Tests.Features.Items.AddItem;

public class AddItemValidatorTests
{
    private readonly AddItemValidator _validator = new();

    [Fact]
    public async Task WithEmptyLabel_IsInvalid()
    {
        // Arrange
        var request = new AddItemRequest(Guid.NewGuid(), "   ");

        // Act
        var result = await _validator.TestValidateAsync(request);

        // Assert
        result.ShouldHaveValidationErrorFor(r => r.Label);
    }

    [Fact]
    public async Task WithLabelOver200Chars_IsInvalid()
    {
        // Arrange
        var request = new AddItemRequest(Guid.NewGuid(), new string('a', 201));

        // Act
        var result = await _validator.TestValidateAsync(request);

        // Assert
        result.ShouldHaveValidationErrorFor(r => r.Label);
    }

    [Fact]
    public async Task WithValidLabel_IsValid()
    {
        // Arrange
        var request = new AddItemRequest(Guid.NewGuid(), "Drinks");

        // Act
        var result = await _validator.TestValidateAsync(request);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }
}
