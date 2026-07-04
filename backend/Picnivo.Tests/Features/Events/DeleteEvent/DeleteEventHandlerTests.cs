using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using DeleteEventHandler = Picnivo.API.Features.Events.DeleteEvent.DeleteEvent;

namespace Picnivo.Tests.Features.Events.DeleteEvent;

public class DeleteEventHandlerTests
{
    [Fact]
    public async Task Organizer_DeletesEvent()
    {
        // Arrange
        await using var db = TestDb.Create();
        var seed = await SeedEventAsync(db);

        // Act
        var result = await DeleteEventHandler.Handle(
            seed.Token,
            UserWith(seed.OrganizerId),
            db,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<NoContent>();
        (await db.Events.AnyAsync(e => e.Id == seed.EventId)).ShouldBeFalse();
        (await db.Participants.AnyAsync(p => p.Id == seed.ParticipantId)).ShouldBeFalse();
        (await db.EventItems.AnyAsync(i => i.Id == seed.ItemId)).ShouldBeFalse();
        (await db.DateOptions.AnyAsync(d => d.Id == seed.DateOptionId)).ShouldBeFalse();
        (await db.DateVotes.AnyAsync(v => v.ParticipantId == seed.ParticipantId)).ShouldBeFalse();
        (await db.ItemClaims.AnyAsync(c => c.ParticipantId == seed.ParticipantId)).ShouldBeFalse();
    }

    [Fact]
    public async Task NonOrganizer_ReturnsForbidden()
    {
        // Arrange
        await using var db = TestDb.Create();
        var seed = await SeedEventAsync(db);

        // Act
        var result = await DeleteEventHandler.Handle(
            seed.Token,
            UserWith(Guid.NewGuid()),
            db,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<StatusCodeHttpResult>().StatusCode.ShouldBe(403);
        (await db.Events.AnyAsync(e => e.Id == seed.EventId)).ShouldBeTrue();
    }

    [Fact]
    public async Task UnknownToken_ReturnsNotFound()
    {
        // Arrange
        await using var db = TestDb.Create();

        // Act
        var result = await DeleteEventHandler.Handle(
            "unknowntokenxyz",
            UserWith(Guid.NewGuid()),
            db,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<NotFound>();
    }

    [Fact]
    public async Task Anonymous_ReturnsUnauthorized()
    {
        // Arrange
        await using var db = TestDb.Create();
        var seed = await SeedEventAsync(db);

        // Act
        var result = await DeleteEventHandler.Handle(
            seed.Token,
            AnonymousUser(),
            db,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<UnauthorizedHttpResult>();
    }

    private static ClaimsPrincipal UserWith(Guid organizerId) =>
        new(new ClaimsIdentity([new Claim("sub", organizerId.ToString())]));

    private static ClaimsPrincipal AnonymousUser() => new(new ClaimsIdentity());

    private static async Task<(
        string Token,
        Guid EventId,
        Guid OrganizerId,
        Guid ParticipantId,
        Guid ItemId,
        Guid DateOptionId
    )> SeedEventAsync(PicnivoDbContext db, string token = "testtoken01")
    {
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(
            new Organizer
            {
                Id = organizerId,
                DisplayName = "Organizer",
                CreatedAt = DateTimeOffset.UtcNow,
            }
        );

        var dateOption = new DateOption
        {
            Id = Guid.CreateVersion7(),
            StartsAt = DateTimeOffset.UtcNow.AddDays(7),
        };
        var item = new EventItem { Id = Guid.CreateVersion7(), Label = "Sandwiches" };
        var participant = new Participant
        {
            Id = Guid.CreateVersion7(),
            DisplayName = "Participant",
            CreatedAt = DateTimeOffset.UtcNow,
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
            Participants = [participant],
        };
        db.Events.Add(@event);
        await db.SaveChangesAsync();

        db.DateVotes.Add(
            new DateVote
            {
                Id = Guid.CreateVersion7(),
                ParticipantId = participant.Id,
                DateOptionId = dateOption.Id,
                Choice = VoteChoice.Yes,
            }
        );
        db.ItemClaims.Add(
            new ItemClaim
            {
                Id = Guid.CreateVersion7(),
                EventItemId = item.Id,
                ParticipantId = participant.Id,
                ClaimedAt = DateTimeOffset.UtcNow,
            }
        );
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        return (token, @event.Id, organizerId, participant.Id, item.Id, dateOption.Id);
    }
}
