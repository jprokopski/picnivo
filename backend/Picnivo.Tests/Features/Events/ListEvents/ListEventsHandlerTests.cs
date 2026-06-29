using System.Security.Claims;
using ListEventsHandler = Picnivo.API.Features.Events.ListEvents.ListEvents;
using Microsoft.AspNetCore.Http.HttpResults;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.API.Features.Events.ListEvents;

namespace Picnivo.Tests.Features.Events.ListEvents;

public class ListEventsHandlerTests
{
    [Fact]
    public async Task ReturnsOnlyCallerEvents()
    {
        // Arrange
        await using var db = TestDb.Create();
        var orgA = Guid.NewGuid();
        var orgB = Guid.NewGuid();
        db.Organizers.AddRange(
            new Organizer { Id = orgA, DisplayName = "A", CreatedAt = DateTimeOffset.UtcNow },
            new Organizer { Id = orgB, DisplayName = "B", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var tokenA = await SeedEventAsync(db, orgA, "A's picnic", token: "tokenorgA01");
        await SeedEventAsync(db, orgB, "B's picnic", token: "tokenorgB01");

        // Act
        var result = await ListEventsHandler.Handle(UserWith(orgA), db, CancellationToken.None);

        // Assert
        var ok = result.ShouldBeOfType<Ok<List<EventSummaryResponse>>>();
        ok.Value!.ShouldContain(s => s.Token == tokenA);
        ok.Value!.ShouldNotContain(s => s.Title == "B's picnic");
    }

    [Fact]
    public async Task SummaryHasCorrectCounts()
    {
        // Arrange
        await using var db = TestDb.Create();
        var orgId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = orgId, DisplayName = "Test", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var token = await SeedEventAsync(db, orgId, "Count Test", dateCount: 3, items: ["A", "B", "C", "D"]);

        // Act
        var result = await ListEventsHandler.Handle(UserWith(orgId), db, CancellationToken.None);

        // Assert
        var ok = result.ShouldBeOfType<Ok<List<EventSummaryResponse>>>();
        var summary = ok.Value!.Single(s => s.Token == token);
        summary.DateOptionCount.ShouldBe(3);
        summary.ItemCount.ShouldBe(4);
        summary.SoonestDate.ShouldNotBeNull();
    }

    private static ClaimsPrincipal UserWith(Guid organizerId) =>
        new(new ClaimsIdentity([new Claim("sub", organizerId.ToString())]));

    private static async Task<string> SeedEventAsync(
        PicnivoDbContext db,
        Guid organizerId,
        string title,
        int dateCount = 2,
        string[]? items = null,
        string token = "testtoken01")
    {
        db.Events.Add(new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = title,
            Token = token,
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions = Enumerable.Range(1, dateCount)
                .Select(i => new DateOption { Id = Guid.CreateVersion7(), StartsAt = DateTimeOffset.UtcNow.AddDays(7 + i) })
                .ToList(),
            Items = (items ?? [])
                .Select(l => new EventItem { Id = Guid.CreateVersion7(), Label = l })
                .ToList()
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return token;
    }
}
