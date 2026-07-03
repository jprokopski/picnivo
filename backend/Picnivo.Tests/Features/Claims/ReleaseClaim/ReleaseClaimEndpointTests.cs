using Microsoft.Extensions.DependencyInjection;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.Tests.Client;

namespace Picnivo.Tests.Features.Claims.ReleaseClaim;

[Collection("Api")]
public class ReleaseClaimEndpointTests(ApiFixture fixture)
{
    [Fact]
    public async Task WithNoExistingClaim_Returns404()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (token, itemId, _) = await SeedEventAsync(ctx.Services);

        // Act
        var ex = await Should.ThrowAsync<ApiException>(
            () => ctx.ApiClient.ReleaseClaimAsync(token, itemId, Guid.NewGuid()));

        // Assert
        ex.StatusCode.ShouldBe(404);
    }

    private static async Task<(string Token, Guid ItemId, Guid ParticipantId)> SeedEventAsync(
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

        var participant = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = @event.Id,
            DisplayName = "Alice",
            Attendance = AttendanceStatus.Coming,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Participants.Add(participant);

        await db.SaveChangesAsync();
        return (token, item.Id, participant.Id);
    }
}
