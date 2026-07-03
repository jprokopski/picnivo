using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.Tests.Client;

namespace Picnivo.Tests.Features.Participants.SetAttendance;

[Collection("Api")]
public class SetAttendanceEndpointTests(ApiFixture fixture)
{
    [Fact]
    public async Task WithUnknownToken_Returns404()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();

        // Act
        var ex = await Should.ThrowAsync<ApiException>(() =>
            ctx.ApiClient.SetAttendanceAsync(
                "unknowntokenxyz",
                Guid.NewGuid(),
                new SetAttendanceRequest { Status = 2 }
            )
        );

        // Assert
        ex.StatusCode.ShouldBe(404);
    }

    [Fact]
    public async Task CountingOut_ReleasesAndOrphansClaim()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (token, participantId, itemId) = await SeedEventWithParticipantAsync(ctx.Services);
        await ctx.ApiClient.ClaimItemAsync(token, itemId, participantId);

        // Act
        await ctx.ApiClient.SetAttendanceAsync(
            token,
            participantId,
            new SetAttendanceRequest { Status = 3 }
        );

        // Assert
        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        (await db.ItemClaims.AnyAsync(c => c.EventItemId == itemId)).ShouldBeFalse();
        var item = await db.EventItems.SingleAsync(i => i.Id == itemId);
        item.OrphanedFromParticipantId.ShouldBe(participantId);
    }

    private static async Task<(
        string Token,
        Guid ParticipantId,
        Guid ItemId
    )> SeedEventWithParticipantAsync(IServiceProvider services, string token = "testtoken01")
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
        var dateOption = new DateOption
        {
            Id = Guid.CreateVersion7(),
            StartsAt = DateTimeOffset.UtcNow.AddDays(7),
        };
        var @event = new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = "Test Picnic",
            Token = token,
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions = [dateOption],
            Items = [item],
        };
        db.Events.Add(@event);

        var participant = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = @event.Id,
            DisplayName = "Alice",
            Attendance = AttendanceStatus.Coming,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Participants.Add(participant);

        await db.SaveChangesAsync();
        return (token, participant.Id, item.Id);
    }
}
