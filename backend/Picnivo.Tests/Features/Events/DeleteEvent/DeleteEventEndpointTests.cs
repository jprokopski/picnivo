using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.Tests.Client;

namespace Picnivo.Tests.Features.Events.DeleteEvent;

[Collection("Api")]
public class DeleteEventEndpointTests(ApiFixture fixture)
{
    [Fact]
    public async Task WithoutAuth_Returns401()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (token, _) = await SeedEventAsync(ctx.Services);

        // Act
        var ex = await Should.ThrowAsync<ApiException>(() => ctx.ApiClient.DeleteEventAsync(token));

        // Assert
        ex.StatusCode.ShouldBe(401);
    }

    [Fact]
    public async Task NonOrganizer_Returns403()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (token, _) = await SeedEventAsync(ctx.Services);

        // Act
        var ex = await Should.ThrowAsync<ApiException>(() =>
            ctx.AuthedApiClient(Guid.NewGuid()).DeleteEventAsync(token)
        );

        // Assert
        ex.StatusCode.ShouldBe(403);

        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        (await db.Events.AnyAsync(e => e.Token == token)).ShouldBeTrue();
    }

    [Fact]
    public async Task Organizer_Returns204AndDeletesEvent()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (token, organizerId) = await SeedEventAsync(ctx.Services);

        // Act
        await ctx.AuthedApiClient(organizerId).DeleteEventAsync(token);

        // Assert
        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        (await db.Events.AnyAsync(e => e.Token == token)).ShouldBeFalse();
    }

    [Fact]
    public async Task WithUnknownToken_Returns404()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();

        // Act
        var ex = await Should.ThrowAsync<ApiException>(() =>
            ctx.AuthedApiClient(Guid.NewGuid()).DeleteEventAsync("unknowntokenxyz")
        );

        // Assert
        ex.StatusCode.ShouldBe(404);
    }

    private static async Task<(string Token, Guid OrganizerId)> SeedEventAsync(
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
        };
        db.Events.Add(@event);

        await db.SaveChangesAsync();
        return (token, organizerId);
    }
}
