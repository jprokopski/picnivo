using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.Tests.Client;

namespace Picnivo.Tests.Features.Events.SelectFinalDate;

[Collection("Api")]
public class SelectFinalDateEndpointTests(ApiFixture fixture)
{
    [Fact]
    public async Task WithoutAuth_Returns401()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (token, _, dateOptionIds) = await SeedEventAsync(ctx.Services);

        // Act
        var ex = await Should.ThrowAsync<ApiException>(() =>
            ctx.ApiClient.SelectFinalDateAsync(
                token,
                new SelectFinalDateRequest { DateOptionId = dateOptionIds[0] }
            )
        );

        // Assert
        ex.StatusCode.ShouldBe(401);
    }

    [Fact]
    public async Task NonOrganizer_Returns403()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (token, _, dateOptionIds) = await SeedEventAsync(ctx.Services);

        // Act
        var ex = await Should.ThrowAsync<ApiException>(() =>
            ctx.AuthedApiClient(Guid.NewGuid())
                .SelectFinalDateAsync(
                    token,
                    new SelectFinalDateRequest { DateOptionId = dateOptionIds[0] }
                )
        );

        // Assert
        ex.StatusCode.ShouldBe(403);
    }

    [Fact]
    public async Task Organizer_Returns204AndSetsChosenDate()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (token, organizerId, dateOptionIds) = await SeedEventAsync(ctx.Services);

        // Act
        await ctx.AuthedApiClient(organizerId)
            .SelectFinalDateAsync(
                token,
                new SelectFinalDateRequest { DateOptionId = dateOptionIds[0] }
            );

        // Assert
        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        var @event = await db.Events.SingleAsync(e => e.Token == token);
        @event.ChosenDateOptionId.ShouldBe(dateOptionIds[0]);
    }

    [Fact]
    public async Task WithInvalidDateOptionId_Returns400()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (token, organizerId, _) = await SeedEventAsync(ctx.Services);

        // Act
        var ex = await Should.ThrowAsync<ApiException>(() =>
            ctx.AuthedApiClient(organizerId)
                .SelectFinalDateAsync(
                    token,
                    new SelectFinalDateRequest { DateOptionId = Guid.NewGuid() }
                )
        );

        // Assert
        ex.StatusCode.ShouldBe(400);
    }

    private static async Task<(
        string Token,
        Guid OrganizerId,
        List<Guid> DateOptionIds
    )> SeedEventAsync(IServiceProvider services, string token = "testtoken01")
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

        var dateOptions = new List<DateOption>
        {
            new() { Id = Guid.CreateVersion7(), StartsAt = DateTimeOffset.UtcNow.AddDays(7) },
            new() { Id = Guid.CreateVersion7(), StartsAt = DateTimeOffset.UtcNow.AddDays(8) },
        };
        var @event = new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = "Test Picnic",
            Token = token,
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions = dateOptions,
        };
        db.Events.Add(@event);

        await db.SaveChangesAsync();
        return (token, organizerId, dateOptions.Select(d => d.Id).ToList());
    }
}
