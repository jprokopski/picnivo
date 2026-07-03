using Microsoft.Extensions.DependencyInjection;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;
using Picnivo.Tests.Client;

namespace Picnivo.Tests.Features.Votes.CastVotes;

[Collection("Api")]
public class CastVotesEndpointTests(ApiFixture fixture)
{
    [Fact]
    public async Task WithUnknownToken_Returns404()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();

        // Act
        var ex = await Should.ThrowAsync<ApiException>(() => ctx.ApiClient.CastVotesAsync(
            "unknowntokenxyz", Guid.NewGuid(), new CastVotesRequest { Votes = [new VoteDto { DateOptionId = Guid.NewGuid(), Choice = 1 }] }));

        // Assert
        ex.StatusCode.ShouldBe(404);
    }

    [Fact]
    public async Task RepeatedVote_NeverYieldsTwoRows()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (token, participantId, dateOptionId) = await SeedEventWithParticipantAsync(ctx.Services);

        // Act
        await ctx.ApiClient.CastVotesAsync(token, participantId,
            new CastVotesRequest { Votes = [new VoteDto { DateOptionId = dateOptionId, Choice = 1 }] });
        await ctx.ApiClient.CastVotesAsync(token, participantId,
            new CastVotesRequest { Votes = [new VoteDto { DateOptionId = dateOptionId, Choice = 3 }] });

        // Assert
        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        var votes = db.DateVotes.Where(v => v.ParticipantId == participantId).ToList();
        votes.ShouldHaveSingleItem();
        votes[0].Choice.ShouldBe(VoteChoice.No);
    }

    private static async Task<(string Token, Guid ParticipantId, Guid DateOptionId)> SeedEventWithParticipantAsync(
        IServiceProvider services, string token = "testtoken01")
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(new Organizer { Id = organizerId, DisplayName = "Organizer", CreatedAt = DateTimeOffset.UtcNow });

        var dateOption = new DateOption { Id = Guid.CreateVersion7(), StartsAt = DateTimeOffset.UtcNow.AddDays(7) };
        var @event = new Event
        {
            Id = Guid.CreateVersion7(),
            OrganizerId = organizerId,
            Title = "Test Picnic",
            Token = token,
            CreatedAt = DateTimeOffset.UtcNow,
            DateOptions = [dateOption, new DateOption { Id = Guid.CreateVersion7(), StartsAt = DateTimeOffset.UtcNow.AddDays(8) }]
        };
        db.Events.Add(@event);

        var participant = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = @event.Id,
            DisplayName = "Alice",
            Attendance = AttendanceStatus.Undecided,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Participants.Add(participant);

        await db.SaveChangesAsync();
        return (token, participant.Id, dateOption.Id);
    }
}
