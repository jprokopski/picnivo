using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.Tests.Client;

namespace Picnivo.Tests.Features.Claims.ClaimItem;

[Collection("Api")]
public class ClaimItemEndpointTests(ApiFixture fixture)
{
    [Fact]
    public async Task WithUnknownToken_Returns404()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();

        // Act
        var ex = await Should.ThrowAsync<ApiException>(
            () => ctx.ApiClient.ClaimItemAsync("unknowntokenxyz", Guid.NewGuid(), Guid.NewGuid()));

        // Assert
        ex.StatusCode.ShouldBe(404);
    }

    [Fact]
    public async Task RaceForSameItem_OneWinsOneGetsConflict()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (token, itemId, aliceId, bobId) = await SeedEventWithTwoComingParticipantsAsync(ctx.Services);

        // Act
        var results = await Task.WhenAll(
            SafeClaimAsync(ctx.ApiClient, token, itemId, aliceId),
            SafeClaimAsync(ctx.ApiClient, token, itemId, bobId));

        // Assert
        results.Count(r => r == 204).ShouldBe(1);
        results.Count(r => r == 409).ShouldBe(1);

        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        (await db.ItemClaims.CountAsync(c => c.EventItemId == itemId)).ShouldBe(1);
    }

    [Fact]
    public async Task ReleaseAfterClaim_FreesTheItem()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (token, itemId, aliceId, _) = await SeedEventWithTwoComingParticipantsAsync(ctx.Services);
        await ctx.ApiClient.ClaimItemAsync(token, itemId, aliceId);

        // Act
        await ctx.ApiClient.ReleaseClaimAsync(token, itemId, aliceId);

        // Assert
        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        (await db.ItemClaims.AnyAsync(c => c.EventItemId == itemId)).ShouldBeFalse();
    }

    private static async Task<int> SafeClaimAsync(PicnivoApiClient client, string token, Guid itemId, Guid participantId)
    {
        try
        {
            await client.ClaimItemAsync(token, itemId, participantId);
            return 204;
        }
        catch (ApiException ex)
        {
            return ex.StatusCode;
        }
    }

    private static async Task<(string Token, Guid ItemId, Guid AliceId, Guid BobId)> SeedEventWithTwoComingParticipantsAsync(
        IServiceProvider services, string token = "testtoken01")
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = organizerId, DisplayName = "Organizer", CreatedAt = DateTimeOffset.UtcNow });

        var item = new EventItem { Id = Guid.CreateVersion7(), Label = "Sandwiches" };
        var @event = new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = "Test Picnic",
            Token = token,
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions = [new DateOption { Id = Guid.CreateVersion7(), StartsAt = DateTimeOffset.UtcNow.AddDays(7) }],
            Items = [item]
        };
        db.Events.Add(@event);

        var alice = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = @event.Id,
            DisplayName = "Alice",
            Attendance = AttendanceStatus.Coming,
            CreatedAt = DateTimeOffset.UtcNow
        };
        var bob = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = @event.Id,
            DisplayName = "Bob",
            Attendance = AttendanceStatus.Coming,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Participants.AddRange(alice, bob);

        await db.SaveChangesAsync();
        return (token, item.Id, alice.Id, bob.Id);
    }
}
