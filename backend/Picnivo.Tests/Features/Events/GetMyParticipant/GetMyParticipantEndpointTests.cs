using Microsoft.Extensions.DependencyInjection;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.Tests.Client;

namespace Picnivo.Tests.Features.Events.GetMyParticipant;

[Collection("Api")]
public class GetMyParticipantEndpointTests(ApiFixture fixture)
{
    [Fact]
    public async Task Organizer_ReturnsTheirParticipantId()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var organizerId = await ArrangeOrganizerAsync(ctx.Services);
        var (token, participantId) = await SeedEventAsync(ctx.Services, organizerId);

        // Act
        var response = await ctx.AuthedApiClient(organizerId).GetMyParticipantAsync(token);

        // Assert
        response.ShouldNotBeNull();
        response.ParticipantId.ShouldBe(participantId);
    }

    [Fact]
    public async Task DifferentAuthenticatedUser_Returns404()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var organizerId = await ArrangeOrganizerAsync(ctx.Services);
        var otherId = await ArrangeOrganizerAsync(ctx.Services);
        var (token, _) = await SeedEventAsync(ctx.Services, organizerId);

        // Act
        var ex = await Should.ThrowAsync<ApiException>(() =>
            ctx.AuthedApiClient(otherId).GetMyParticipantAsync(token)
        );

        // Assert
        ex.StatusCode.ShouldBe(404);
    }

    [Fact]
    public async Task Unauthenticated_Returns401()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var organizerId = await ArrangeOrganizerAsync(ctx.Services);
        var (token, _) = await SeedEventAsync(ctx.Services, organizerId);

        // Act
        var ex = await Should.ThrowAsync<ApiException>(() =>
            ctx.ApiClient.GetMyParticipantAsync(token)
        );

        // Assert
        ex.StatusCode.ShouldBe(401);
    }

    [Fact]
    public async Task UnknownToken_Returns404()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var organizerId = await ArrangeOrganizerAsync(ctx.Services);

        // Act
        var ex = await Should.ThrowAsync<ApiException>(() =>
            ctx.AuthedApiClient(organizerId).GetMyParticipantAsync("unknowntokenxyz")
        );

        // Assert
        ex.StatusCode.ShouldBe(404);
    }

    [Fact]
    public async Task OrganizerWithNoOrganizerParticipant_Returns404()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var organizerId = await ArrangeOrganizerAsync(ctx.Services);
        var token = await SeedEventWithoutOrganizerParticipantAsync(ctx.Services, organizerId);

        // Act
        var ex = await Should.ThrowAsync<ApiException>(() =>
            ctx.AuthedApiClient(organizerId).GetMyParticipantAsync(token)
        );

        // Assert
        ex.StatusCode.ShouldBe(404);
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

    private static async Task<(string Token, Guid ParticipantId)> SeedEventAsync(
        IServiceProvider services,
        Guid organizerId
    )
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();

        var organizerParticipant = new Participant
        {
            Id = Guid.CreateVersion7(),
            DisplayName = "Test Organizer",
            Attendance = AttendanceStatus.Undecided,
            IsOrganizer = true,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        var @event = new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = "Test Picnic",
            Token = "testtoken01",
            CreatedAt = DateTimeOffset.UtcNow,
            Participants = [organizerParticipant],
        };

        db.Events.Add(@event);
        await db.SaveChangesAsync();
        return (@event.Token, organizerParticipant.Id);
    }

    private static async Task<string> SeedEventWithoutOrganizerParticipantAsync(
        IServiceProvider services,
        Guid organizerId
    )
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();

        var @event = new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = "Test Picnic",
            Token = "testtoken02",
            CreatedAt = DateTimeOffset.UtcNow,
            Participants = [],
        };

        db.Events.Add(@event);
        await db.SaveChangesAsync();
        return @event.Token;
    }
}
