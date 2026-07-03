using FluentValidation;

namespace Picnivo.API.Features.Items.AddItem;

public class AddItemValidator : AbstractValidator<AddItemRequest>
{
    public AddItemValidator()
    {
        RuleFor(x => x.Label)
            .NotEmpty()
            .MaximumLength(200);
    }
}
