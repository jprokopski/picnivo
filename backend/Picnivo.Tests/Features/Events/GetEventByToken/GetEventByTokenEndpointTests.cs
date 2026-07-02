using Microsoft.Extensions.DependencyInjection;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.Tests.Client;

namespace Picnivo.Tests.Features.Events.GetEventByToken;

[Collection("Api")]
public class GetEventByTokenEndpointTests(ApiFixture fixture)
{
    [Fact]
    public async Task WithUnknownToken_Returns404()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();

        // Act
        var ex = await Should.ThrowAsync<ApiException>(
            () => ctx.ApiClient.GetEventByTokenAsync("unknowntokenxyz"));

        // Assert
        ex.StatusCode.ShouldBe(404);
    }

    [Fact]
    public async Task RequiresNoAuth()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var organizerId = await ArrangeOrganizerAsync(ctx.Services);
        var token = await SeedEventAsync(ctx.Services, organizerId);

        // Act
        var response = await ctx.ApiClient.GetEventByTokenAsync(token);

        // Assert
        response.ShouldNotBeNull();
        response.Title.ShouldBe("Test Picnic");
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

    private static async Task<string> SeedEventAsync(IServiceProvider services, Guid organizerId)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();

        var @event = new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = "Test Picnic",
            Token = "testtoken01",
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions = [new DateOption { Id = Guid.CreateVersion7(), StartsAt = DateTimeOffset.UtcNow.AddDays(7) }]
        };

        db.Events.Add(@event);
        await db.SaveChangesAsync();
        return @event.Token;
    }
}
