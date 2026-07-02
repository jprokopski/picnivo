using GetEventByTokenHandler = Picnivo.API.Features.Events.GetEventByToken.GetEventByToken;
using Microsoft.AspNetCore.Http.HttpResults;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.API.Features.Events.GetEventByToken;

namespace Picnivo.Tests.Features.Events.GetEventByToken;

public class GetEventByTokenHandlerTests
{
    [Fact]
    public async Task ReturnsEventDetail()
    {
        // Arrange
        await using var db = TestDb.Create();
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = organizerId, DisplayName = "Organizer A", CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var token = await SeedEventAsync(db, organizerId,
            title: "Token Detail Test",
            description: "My description",
            location: "My location",
            dateOptions: [DateTimeOffset.UtcNow.AddDays(10)],
            items: ["Balloons"]);

        // Act
        var result = await GetEventByTokenHandler.Handle(token, db, CancellationToken.None);

        // Assert
        var ok = result.ShouldBeOfType<Ok<EventDetailResponse>>();
        ok.Value!.Title.ShouldBe("Token Detail Test");
        ok.Value.Description.ShouldBe("My description");
        ok.Value.Location.ShouldBe("My location");
        ok.Value.OrganizerName.ShouldBe("Organizer A");
        ok.Value.DateOptions.ShouldHaveSingleItem();
        ok.Value.Items[0].Label.ShouldBe("Balloons");
    }

    [Fact]
    public async Task WithUnknownToken_ReturnsNotFound()
    {
        // Arrange
        await using var db = TestDb.Create();

        // Act
        var result = await GetEventByTokenHandler.Handle("unknowntoken", db, CancellationToken.None);

        // Assert
        result.ShouldBeOfType<NotFound>();
    }

    private static async Task<string> SeedEventAsync(
        PicnivoDbContext db,
        Guid organizerId,
        string title,
        string? description = null,
        string? location = null,
        DateTimeOffset[]? dateOptions = null,
        string[]? items = null,
        string token = "testtoken01")
    {
        db.Events.Add(new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = title,
            Description = description,
            Location = location,
            Token = token,
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions = (dateOptions ?? [DateTimeOffset.UtcNow.AddDays(7)])
                .Select(d => new DateOption { Id = Guid.CreateVersion7(), StartsAt = d })
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
