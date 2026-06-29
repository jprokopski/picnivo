using Microsoft.Extensions.DependencyInjection;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.Tests.Client;

namespace Picnivo.Tests.Features.Events.ListEvents;

[Collection("Api")]
public class ListEventsEndpointTests(ApiFixture fixture)
{
    [Fact]
    public async Task WithoutAuth_Returns401()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();

        // Act
        var ex = await Should.ThrowAsync<ApiException>(
            () => ctx.ApiClient.ListEventsAsync());

        // Assert
        ex.StatusCode.ShouldBe(401);
    }

    [Fact]
    public async Task ReturnsOnlyCallersEvents()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var organizerId = await ArrangeOrganizerAsync(ctx.Services);
        var otherId = await ArrangeOrganizerAsync(ctx.Services);
        await SeedEventAsync(ctx.Services, organizerId, "My Picnic", "testtoken01");
        await SeedEventAsync(ctx.Services, otherId, "Their Picnic", "testtoken02");

        // Act
        var response = await ctx.AuthedApiClient(organizerId).ListEventsAsync();

        // Assert
        response.ShouldNotBeNull();
        response.Count.ShouldBe(1);
        var item = response.First();
        item.Title.ShouldBe("My Picnic");
        item.DateOptionCount.ShouldBe(1);
        item.ItemCount.ShouldBe(1);
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

    private static async Task SeedEventAsync(IServiceProvider services, Guid organizerId, string title, string token = "testtoken01")
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        db.Events.Add(new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = title,
            Token = token,
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions = [new DateOption { Id = Guid.CreateVersion7(), StartsAt = DateTimeOffset.UtcNow.AddDays(7) }],
            Items = [new EventItem { Id = Guid.CreateVersion7(), Label = "Sandwiches" }]
        });
        await db.SaveChangesAsync();
    }
}
