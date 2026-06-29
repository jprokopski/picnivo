namespace Picnivo.API;

public static class EndpointExtensions
{
    extension(WebApplication app)
    {
        public WebApplication MapEndpoints()
        {
            var group = app.MapGroup("").AddEndpointFilter<ValidationEndpointFilter>();

            var types = typeof(Program).Assembly
                .GetTypes()
                .Where(t => t is { IsClass: true, IsAbstract: false } && t.IsAssignableTo(typeof(IEndpoint)));

            foreach (var type in types)
            {
                var endpoint = (IEndpoint)Activator.CreateInstance(type)!;
                endpoint.Map(group);
            }

            return app;
        }
    }
}
