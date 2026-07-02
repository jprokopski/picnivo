using Microsoft.Extensions.DependencyInjection;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.Tests.Client;

namespace Picnivo.Tests.Features.Events.CreateEvent;

[Collection("Api")]
public class CreateEventEndpointTests(ApiFixture fixture)
{
    [Fact]
    public async Task WithoutAuth_Returns401()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();

        // Act
        var ex = await Should.ThrowAsync<ApiException>(
            () => ctx.ApiClient.CreateEventAsync(DefaultCreateRequest()));

        // Assert
        ex.StatusCode.ShouldBe(401);
    }

    [Fact]
    public async Task WithInvalidData_Returns400WithValidationErrors()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var organizerId = await ArrangeOrganizerAsync(ctx.Services);
        var req = new CreateEventRequest
        {
            Title = "",
            DateOptions = [DateTimeOffset.UtcNow.AddDays(7)],
            Items = []
        };

        // Act
        var ex = await Should.ThrowAsync<ApiException<Client.HttpValidationProblemDetails>>(
            () => ctx.AuthedApiClient(organizerId).CreateEventAsync(req));

        // Assert
        ex.StatusCode.ShouldBe(400);
        ex.Result.Errors.ShouldNotBeEmpty();
    }

    [Fact]
    public async Task WithValidData_Returns201WithToken()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var organizerId = await ArrangeOrganizerAsync(ctx.Services);

        // Act
        var response = await ctx.AuthedApiClient(organizerId).CreateEventAsync(DefaultCreateRequest());

        // Assert
        response.ShouldNotBeNull();
        response.Token.ShouldNotBeEmpty();
        response.Id.ShouldNotBe(Guid.Empty);
        response.ParticipantId.ShouldNotBe(Guid.Empty);
    }

    private static async Task<Guid> ArrangeOrganizerAsync(IServiceProvider services)
    {
        var id = Guid.NewGuid();
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        db.Organizers.Add(new Organizer { Id = id, DisplayName = "Test Organizer", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        return id;
    }

    private static CreateEventRequest DefaultCreateRequest(int dateCount = 2) => new()
    {
        Title = "Test Picnic",
        Description = "A lovely picnic",
        Location = "Central Park",
        DateOptions = Enumerable.Range(1, dateCount)
            .Select(i => DateTimeOffset.UtcNow.AddDays(7 + i))
            .ToList(),
        Items = ["Sandwiches", "Drinks"]
    };
}
