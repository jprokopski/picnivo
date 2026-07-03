using FluentValidation;

namespace Picnivo.API;

public class ValidationEndpointFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next
    )
    {
        foreach (var arg in context.Arguments)
        {
            if (arg is null)
            {
                continue;
            }
            var validatorType = typeof(IValidator<>).MakeGenericType(arg.GetType());
            if (
                context.HttpContext.RequestServices.GetService(validatorType)
                is not IValidator validator
            )
            {
                continue;
            }

            var result = await validator.ValidateAsync(
                new ValidationContext<object>(arg),
                context.HttpContext.RequestAborted
            );
            if (!result.IsValid)
            {
                var errors = result
                    .Errors.GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());
                return Results.ValidationProblem(errors);
            }
        }

        return await next(context);
    }
}
