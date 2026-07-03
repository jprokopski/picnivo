using FluentValidation;

namespace Picnivo.API.Features.Participants.JoinEvent;

public class JoinEventValidator : AbstractValidator<JoinEventRequest>
{
    public JoinEventValidator()
    {
        RuleFor(x => x.DisplayName)
            .NotEmpty()
            .MaximumLength(100);
    }
}
