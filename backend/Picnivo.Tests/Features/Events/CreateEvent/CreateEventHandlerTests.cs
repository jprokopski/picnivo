using System.Security.Claims;
using CreateEventHandler = Picnivo.API.Features.Events.CreateEvent.CreateEvent;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.API.Features.Events.CreateEvent;

namespace Picnivo.Tests.Features.Events.CreateEvent;

public class CreateEventHandlerTests
{
    [Fact]
    public async Task PersistsDateOptionsAndItems()
    {
        // Arrange
        var organizerId = Guid.NewGuid();
        await using var db = await SeedDbAsync(organizerId);
        var req = new CreateEventRequest(
            Title: "My Picnic",
            Description: null,
            Location: null,
            DateOptions: [DateTimeOffset.UtcNow.AddDays(7), DateTimeOffset.UtcNow.AddDays(8)],
            Items: ["Sandwiches", "Drinks"]);

        // Act
        await CreateEventHandler.Handle(req, UserWith(organizerId), db, CancellationToken.None);

        // Assert
        db.ChangeTracker.Clear();
        var ev = await db.Events.Include(e => e.DateOptions).Include(e => e.Items).SingleAsync();
        ev.DateOptions.Count.ShouldBe(2);
        ev.Items.Count.ShouldBe(2);
    }

    [Fact]
    public async Task EachCallProducesUniqueToken()
    {
        // Arrange
        var organizerId = Guid.NewGuid();
        await using var db = await SeedDbAsync(organizerId);
        var user = UserWith(organizerId);
        var req = new CreateEventRequest(
            Title: "Picnic",
            Description: null,
            Location: null,
            DateOptions: [DateTimeOffset.UtcNow.AddDays(7)],
            Items: []);

        // Act
        for (var i = 0; i < 5; i++)
        {
            await CreateEventHandler.Handle(req, user, db, CancellationToken.None);
            db.ChangeTracker.Clear();
        }

        // Assert
        var tokens = await db.Events.Select(e => e.Token).ToListAsync();
        tokens.Count.ShouldBe(5);
        tokens.Distinct().Count().ShouldBe(5);
    }

    private static ClaimsPrincipal UserWith(Guid organizerId) =>
        new(new ClaimsIdentity([new Claim("sub", organizerId.ToString())]));

    private static async Task<PicnivoDbContext> SeedDbAsync(Guid organizerId)
    {
        var db = TestDb.Create();
        db.Organizers.Add(new Organizer
        {
            Id = organizerId,
            DisplayName = "Test Organizer",
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return db;
    }
}
