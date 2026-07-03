using FluentValidation;

namespace Picnivo.API.Features.Events.CreateEvent;

public class CreateEventValidator : AbstractValidator<CreateEventRequest>
{
    public CreateEventValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);

        RuleFor(x => x.DateOptions).NotEmpty();

        RuleFor(x => x.DateOptions)
            .Must(d => d.Count <= 10)
            .When(d => d.DateOptions is { Count: > 0 })
            .Must(d => d.All(date => date.ToUniversalTime() > DateTimeOffset.UtcNow))
            .When(d => d.DateOptions is { Count: > 0 });

        RuleFor(x => x.Items)
            .Must(i => i.Count <= 50)
            .When(x => x.Items is { Count: > 0 })
            .WithMessage("Events can have at most 50 items.");

        RuleForEach(x => x.Items).NotEmpty().When(x => x.Items is { Count: > 0 });
    }
}
