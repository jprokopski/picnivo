using Microsoft.Extensions.DependencyInjection;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.Tests.Client;

namespace Picnivo.Tests.Features.Participants.JoinEvent;

[Collection("Api")]
public class JoinEventEndpointTests(ApiFixture fixture)
{
    [Fact]
    public async Task WithUnknownToken_Returns404()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();

        // Act
        var ex = await Should.ThrowAsync<ApiException>(
            () => ctx.ApiClient.JoinEventAsync("unknowntokenxyz", new JoinEventRequest { DisplayName = "Alice" }));

        // Assert
        ex.StatusCode.ShouldBe(404);
    }

    [Fact]
    public async Task WithValidName_Returns200WithParticipantId()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var token = await SeedEventAsync(ctx.Services);

        // Act
        var response = await ctx.ApiClient.JoinEventAsync(token, new JoinEventRequest { DisplayName = "Alice" });

        // Assert
        response.ShouldNotBeNull();
        response.ParticipantId.ShouldNotBe(Guid.Empty);
        response.DuplicateName.ShouldBeFalse();
    }

    [Fact]
    public async Task WithEmptyName_Returns400WithValidationErrors()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var token = await SeedEventAsync(ctx.Services);

        // Act
        var ex = await Should.ThrowAsync<ApiException<Client.HttpValidationProblemDetails>>(
            () => ctx.ApiClient.JoinEventAsync(token, new JoinEventRequest { DisplayName = "" }));

        // Assert
        ex.StatusCode.ShouldBe(400);
        ex.Result.Errors.ShouldNotBeEmpty();
    }

    private static async Task<string> SeedEventAsync(IServiceProvider services, string token = "testtoken01")
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = organizerId, DisplayName = "Organizer", CreatedAt = DateTimeOffset.UtcNow });
        db.Events.Add(new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = "Test Picnic",
            Token = token,
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions = [new DateOption { Id = Guid.CreateVersion7(), StartsAt = DateTimeOffset.UtcNow.AddDays(7) }]
        });
        await db.SaveChangesAsync();
        return token;
    }
}
