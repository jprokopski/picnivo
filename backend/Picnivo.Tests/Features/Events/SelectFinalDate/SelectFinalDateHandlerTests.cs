using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.API.Features.Events.SelectFinalDate;
using Picnivo.API.Features.Streaming;
using SelectFinalDateHandler = Picnivo.API.Features.Events.SelectFinalDate.SelectFinalDate;

namespace Picnivo.Tests.Features.Events.SelectFinalDate;

public class SelectFinalDateHandlerTests
{
    [Fact]
    public async Task Organizer_SetsChosenDate()
    {
        // Arrange
        await using var db = TestDb.Create();
        var broker = new EventStreamBroker();
        var (token, eventId, organizerId, dateOptionIds) = await SeedEventAsync(db);
        var before = broker.CurrentRevision(token);

        // Act
        var result = await SelectFinalDateHandler.Handle(
            token,
            new SelectFinalDateRequest(dateOptionIds[0]),
            UserWith(organizerId),
            db,
            broker,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<NoContent>();
        var @event = await db.Events.SingleAsync(e => e.Id == eventId);
        @event.ChosenDateOptionId.ShouldBe(dateOptionIds[0]);
        broker.CurrentRevision(token).ShouldBeGreaterThan(before);
    }

    [Fact]
    public async Task NonOrganizer_ReturnsForbidden()
    {
        // Arrange
        await using var db = TestDb.Create();
        var broker = new EventStreamBroker();
        var (token, _, _, dateOptionIds) = await SeedEventAsync(db);
        var before = broker.CurrentRevision(token);

        // Act
        var result = await SelectFinalDateHandler.Handle(
            token,
            new SelectFinalDateRequest(dateOptionIds[0]),
            UserWith(Guid.NewGuid()),
            db,
            broker,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<StatusCodeHttpResult>().StatusCode.ShouldBe(403);
        broker.CurrentRevision(token).ShouldBe(before);
    }

    [Fact]
    public async Task WithInvalidDateOptionId_ReturnsBadRequest()
    {
        // Arrange
        await using var db = TestDb.Create();
        var broker = new EventStreamBroker();
        var (token, _, organizerId, _) = await SeedEventAsync(db);

        // Act
        var result = await SelectFinalDateHandler.Handle(
            token,
            new SelectFinalDateRequest(Guid.NewGuid()),
            UserWith(organizerId),
            db,
            broker,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<BadRequest>();
    }

    [Fact]
    public async Task WithNullDateOptionId_Unlocks()
    {
        // Arrange
        await using var db = TestDb.Create();
        var broker = new EventStreamBroker();
        var (token, eventId, organizerId, dateOptionIds) = await SeedEventAsync(db);
        await SelectFinalDateHandler.Handle(
            token,
            new SelectFinalDateRequest(dateOptionIds[0]),
            UserWith(organizerId),
            db,
            broker,
            CancellationToken.None
        );
        db.ChangeTracker.Clear();

        // Act
        var result = await SelectFinalDateHandler.Handle(
            token,
            new SelectFinalDateRequest(null),
            UserWith(organizerId),
            db,
            broker,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<NoContent>();
        var @event = await db.Events.SingleAsync(e => e.Id == eventId);
        @event.ChosenDateOptionId.ShouldBeNull();
    }

    private static ClaimsPrincipal UserWith(Guid organizerId) =>
        new(new ClaimsIdentity([new Claim("sub", organizerId.ToString())]));

    private static async Task<(
        string Token,
        Guid EventId,
        Guid OrganizerId,
        List<Guid> DateOptionIds
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
        db.ChangeTracker.Clear();
        return (token, @event.Id, organizerId, dateOptions.Select(d => d.Id).ToList());
    }
}
