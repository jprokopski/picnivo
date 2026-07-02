using FluentValidation;
using Picnivo.API.Data.Models;

namespace Picnivo.API.Features.Participants.SetAttendance;

public class SetAttendanceValidator : AbstractValidator<SetAttendanceRequest>
{
    public SetAttendanceValidator()
    {
        RuleFor(x => x.Status)
            .IsInEnum()
            .NotEqual(AttendanceStatus.Invalid);
    }
}
