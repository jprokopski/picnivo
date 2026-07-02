using FluentValidation.TestHelper;
using Picnivo.API.Data.Models;
using Picnivo.API.Features.Participants.SetAttendance;

namespace Picnivo.Tests.Features.Participants.SetAttendance;

public class SetAttendanceValidatorTests
{
    private readonly SetAttendanceValidator _validator = new();

    [Fact]
    public async Task WithInvalidStatus_IsInvalid()
    {
        // Arrange
        var request = new SetAttendanceRequest(AttendanceStatus.Invalid);

        // Act
        var result = await _validator.TestValidateAsync(request);

        // Assert
        result.ShouldHaveValidationErrorFor(r => r.Status);
    }

    [Fact]
    public async Task WithComing_IsValid()
    {
        // Arrange
        var request = new SetAttendanceRequest(AttendanceStatus.Coming);

        // Act
        var result = await _validator.TestValidateAsync(request);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public async Task WithOut_IsValid()
    {
        // Arrange
        var request = new SetAttendanceRequest(AttendanceStatus.Out);

        // Act
        var result = await _validator.TestValidateAsync(request);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }
}
