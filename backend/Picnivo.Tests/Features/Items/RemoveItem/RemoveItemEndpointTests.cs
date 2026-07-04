using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.Tests.Client;

namespace Picnivo.Tests.Features.Items.RemoveItem;

[Collection("Api")]
public class RemoveItemEndpointTests(ApiFixture fixture)
{
    [Fact]
    public async Task WithUnknownToken_Returns404()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();

        // Act
        var ex = await Should.ThrowAsync<ApiException>(() =>
            ctx.ApiClient.RemoveItemAsync("unknowntokenxyz", Guid.NewGuid(), null)
        );

        // Assert
        ex.StatusCode.ShouldBe(404);
    }

    [Fact]
    public async Task OrganizerDeletesAnyItem_Returns204()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (token, itemId, organizerId) = await SeedEventAsync(ctx.Services);

        // Act
        await ctx.AuthedApiClient(organizerId).RemoveItemAsync(token, itemId, null);

        // Assert
        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        (await db.EventItems.AnyAsync(i => i.Id == itemId)).ShouldBeFalse();
    }

    [Fact]
    public async Task NonAdderNonOrganizer_Returns403()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (token, itemId, _) = await SeedEventAsync(ctx.Services);

        // Act
        var ex = await Should.ThrowAsync<ApiException>(() =>
            ctx.ApiClient.RemoveItemAsync(token, itemId, Guid.NewGuid())
        );

        // Assert
        ex.StatusCode.ShouldBe(403);
    }

    [Fact]
    public async Task CrossEventItemId_Returns404()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (_, itemIdA, _) = await SeedEventAsync(ctx.Services, "testtoken01");
        var (tokenB, _, organizerB) = await SeedEventAsync(ctx.Services, "testtoken02");

        // Act
        var ex = await Should.ThrowAsync<ApiException>(() =>
            ctx.AuthedApiClient(organizerB).RemoveItemAsync(tokenB, itemIdA, null)
        );

        // Assert
        ex.StatusCode.ShouldBe(404);

        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        (await db.EventItems.AnyAsync(i => i.Id == itemIdA)).ShouldBeTrue();
    }

    private static async Task<(string Token, Guid ItemId, Guid OrganizerId)> SeedEventAsync(
        IServiceProvider services,
        string token = "testtoken01"
    )
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(
            new Organizer
            {
                Id = organizerId,
                DisplayName = "Organizer",
                CreatedAt = DateTimeOffset.UtcNow,
            }
        );

        var item = new EventItem { Id = Guid.CreateVersion7(), Label = "Sandwiches" };
        var @event = new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = "Test Picnic",
            Token = token,
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions =
            [
                new DateOption
                {
                    Id = Guid.CreateVersion7(),
                    StartsAt = DateTimeOffset.UtcNow.AddDays(7),
                },
            ],
            Items = [item],
        };
        db.Events.Add(@event);

        await db.SaveChangesAsync();
        return (token, item.Id, organizerId);
    }
}
