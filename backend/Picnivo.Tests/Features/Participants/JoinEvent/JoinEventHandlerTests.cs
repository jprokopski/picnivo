using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.API.Features.Participants.JoinEvent;
using JoinEventHandler = Picnivo.API.Features.Participants.JoinEvent.JoinEvent;

namespace Picnivo.Tests.Features.Participants.JoinEvent;

public class JoinEventHandlerTests
{
    [Fact]
    public async Task CreatesParticipant()
    {
        // Arrange
        await using var db = TestDb.Create();
        var token = await SeedEventAsync(db);

        // Act
        var result = await JoinEventHandler.Handle(
            token,
            new JoinEventRequest("Alice"),
            db,
            CancellationToken.None
        );

        // Assert
        var ok = result.ShouldBeOfType<Ok<JoinEventResponse>>();
        ok.Value!.ParticipantId.ShouldNotBe(Guid.Empty);
        ok.Value.DuplicateName.ShouldBeFalse();

        var participant = await db.Participants.SingleAsync();
        participant.DisplayName.ShouldBe("Alice");
        participant.Attendance.ShouldBe(AttendanceStatus.Undecided);
    }

    [Fact]
    public async Task WithExistingName_FlagsDuplicateButStillJoins()
    {
        // Arrange
        await using var db = TestDb.Create();
        var token = await SeedEventAsync(db);
        await JoinEventHandler.Handle(
            token,
            new JoinEventRequest("Alice"),
            db,
            CancellationToken.None
        );
        db.ChangeTracker.Clear();

        // Act
        var result = await JoinEventHandler.Handle(
            token,
            new JoinEventRequest("alice"),
            db,
            CancellationToken.None
        );

        // Assert
        var ok = result.ShouldBeOfType<Ok<JoinEventResponse>>();
        ok.Value!.DuplicateName.ShouldBeTrue();
        (await db.Participants.CountAsync()).ShouldBe(2);
    }

    [Fact]
    public async Task WithUnknownToken_ReturnsNotFound()
    {
        // Arrange
        await using var db = TestDb.Create();

        // Act
        var result = await JoinEventHandler.Handle(
            "unknowntoken",
            new JoinEventRequest("Alice"),
            db,
            CancellationToken.None
        );

        // Assert
        result.ShouldBeOfType<NotFound>();
    }

    private static async Task<string> SeedEventAsync(
        PicnivoDbContext db,
        string token = "testtoken01"
    )
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
        db.Events.Add(
            new Event
            {
                Id = Guid.CreateVersion7(),
                OrganizerId = organizerId,
                Title = "Test Picnic",
                Token = token,
                CreatedAt = DateTimeOffset.UtcNow,
                DateOptions =
                [
                    new DateOption
                    {
                        Id = Guid.CreateVersion7(),
                        StartsAt = DateTimeOffset.UtcNow.AddDays(7),
                    },
                ],
            }
        );
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return token;
    }
}
