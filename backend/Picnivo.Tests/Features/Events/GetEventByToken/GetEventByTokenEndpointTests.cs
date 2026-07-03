using Microsoft.EntityFrameworkCore;
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
        var ex = await Should.ThrowAsync<ApiException>(() =>
            ctx.ApiClient.GetEventByTokenAsync("unknowntokenxyz", null)
        );

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
        var response = await ctx.ApiClient.GetEventByTokenAsync(token, null);

        // Assert
        response.ShouldNotBeNull();
        response.Title.ShouldBe("Test Picnic");
    }

    [Fact]
    public async Task JoinVoteThenGet_ReturnsTalliesBestDateAndYou()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var organizerId = await ArrangeOrganizerAsync(ctx.Services);
        var token = await SeedEventAsync(ctx.Services, organizerId, dateOptionCount: 2);
        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        var dateOptionId = await db
            .Events.Where(e => e.Token == token)
            .SelectMany(e => e.DateOptions)
            .Select(d => d.Id)
            .FirstAsync();

        // Act
        var joinResponse = await ctx.ApiClient.JoinEventAsync(
            token,
            new JoinEventRequest { DisplayName = "Alice" }
        );
        await ctx.ApiClient.CastVotesAsync(
            token,
            joinResponse.ParticipantId,
            new CastVotesRequest
            {
                Votes = [new VoteDto { DateOptionId = dateOptionId, Choice = 1 }],
            }
        );
        var response = await ctx.ApiClient.GetEventByTokenAsync(token, joinResponse.ParticipantId);

        // Assert
        response.ShouldNotBeNull();
        response.BestDateOptionId.ShouldBe(dateOptionId);
        response.DateOptions.Single(d => d.Id == dateOptionId).YesCount.ShouldBe(1);
        response.You.ShouldNotBeNull();
        response.You.Votes.ShouldHaveSingleItem();
    }

    private static async Task<Guid> ArrangeOrganizerAsync(IServiceProvider services)
    {
        var id = Guid.NewGuid();
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        db.Organizers.Add(
            new Organizer
            {
                Id = id,
                DisplayName = "Test Organizer",
                CreatedAt = DateTimeOffset.UtcNow,
            }
        );
        await db.SaveChangesAsync();
        return id;
    }

    private static async Task<string> SeedEventAsync(
        IServiceProvider services,
        Guid organizerId,
        int dateOptionCount = 1
    )
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
            DateOptions = Enumerable
                .Range(1, dateOptionCount)
                .Select(i => new DateOption
                {
                    Id = Guid.CreateVersion7(),
                    StartsAt = DateTimeOffset.UtcNow.AddDays(7 + i),
                })
                .ToList(),
        };

        db.Events.Add(@event);
        await db.SaveChangesAsync();
        return @event.Token;
    }
}
