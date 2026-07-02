using Microsoft.Extensions.DependencyInjection;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.Tests.Client;

namespace Picnivo.Tests.Features.Items.AddItem;

[Collection("Api")]
public class AddItemEndpointTests(ApiFixture fixture)
{
    [Fact]
    public async Task WithUnknownToken_Returns404()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();

        // Act
        var ex = await Should.ThrowAsync<ApiException>(() => ctx.ApiClient.AddItemAsync(
            "unknowntokenxyz", new AddItemRequest { ParticipantId = Guid.NewGuid(), Label = "Drinks" }));

        // Assert
        ex.StatusCode.ShouldBe(404);
    }

    [Fact]
    public async Task WithValidLabel_Returns201()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (token, participantId) = await SeedEventWithParticipantAsync(ctx.Services);

        // Act
        var response = await ctx.ApiClient.AddItemAsync(
            token, new AddItemRequest { ParticipantId = participantId, Label = "Drinks" });

        // Assert
        response.ShouldNotBeNull();
        response.Id.ShouldNotBe(Guid.Empty);
    }

    private static async Task<(string Token, Guid ParticipantId)> SeedEventWithParticipantAsync(
        IServiceProvider services, string token = "testtoken01")
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = organizerId, DisplayName = "Organizer", CreatedAt = DateTimeOffset.UtcNow });
        var @event = new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = "Test Picnic",
            Token = token,
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions = [new DateOption { Id = Guid.CreateVersion7(), StartsAt = DateTimeOffset.UtcNow.AddDays(7) }]
        };
        db.Events.Add(@event);

        var participant = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = @event.Id,
            DisplayName = "Alice",
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Participants.Add(participant);

        await db.SaveChangesAsync();
        return (token, participant.Id);
    }
}
