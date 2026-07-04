using EntityFramework.Exceptions.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;

namespace Picnivo.Tests.Features.Votes.CastVotes;

[Collection("Api")]
public class CastVotesConstraintTests(ApiFixture fixture)
{
    [Fact]
    public async Task DuplicateParticipantAndDateOption_ThrowsUniqueConstraintException()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (participantId, dateOptionId) = await SeedEventWithParticipantAsync(ctx.Services);

        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        db.DateVotes.Add(
            new DateVote
            {
                Id = Guid.CreateVersion7(),
                ParticipantId = participantId,
                DateOptionId = dateOptionId,
                Choice = VoteChoice.Yes,
            }
        );
        await db.SaveChangesAsync();

        // Act
        db.DateVotes.Add(
            new DateVote
            {
                Id = Guid.CreateVersion7(),
                ParticipantId = participantId,
                DateOptionId = dateOptionId,
                Choice = VoteChoice.No,
            }
        );
        await Should.ThrowAsync<UniqueConstraintException>(() => db.SaveChangesAsync());

        // Assert
        using var assertScope = ctx.Services.CreateScope();
        var assertDb = assertScope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        (
            await assertDb.DateVotes.CountAsync(v =>
                v.ParticipantId == participantId && v.DateOptionId == dateOptionId
            )
        ).ShouldBe(1);
    }

    private static async Task<(
        Guid ParticipantId,
        Guid DateOptionId
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
        };
        db.Events.Add(@event);

        var participant = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = @event.Id,
            DisplayName = "Alice",
            Attendance = AttendanceStatus.Undecided,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Participants.Add(participant);

        await db.SaveChangesAsync();
        return (participant.Id, dateOption.Id);
    }
}
