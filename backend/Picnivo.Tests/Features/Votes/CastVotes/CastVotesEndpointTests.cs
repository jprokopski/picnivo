using Microsoft.EntityFrameworkCore;
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
        var ex = await Should.ThrowAsync<ApiException>(() =>
            ctx.ApiClient.CastVotesAsync(
                "unknowntokenxyz",
                Guid.NewGuid(),
                new CastVotesRequest
                {
                    Votes = [new VoteDto { DateOptionId = Guid.NewGuid(), Choice = 1 }],
                }
            )
        );

        // Assert
        ex.StatusCode.ShouldBe(404);
    }

    [Fact]
    public async Task RepeatedVote_NeverYieldsTwoRows()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (token, participantId, dateOptionId) = await SeedEventWithParticipantAsync(
            ctx.Services
        );

        // Act
        await ctx.ApiClient.CastVotesAsync(
            token,
            participantId,
            new CastVotesRequest
            {
                Votes = [new VoteDto { DateOptionId = dateOptionId, Choice = 1 }],
            }
        );
        await ctx.ApiClient.CastVotesAsync(
            token,
            participantId,
            new CastVotesRequest
            {
                Votes = [new VoteDto { DateOptionId = dateOptionId, Choice = 3 }],
            }
        );

        // Assert
        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        var votes = db.DateVotes.Where(v => v.ParticipantId == participantId).ToList();
        votes.ShouldHaveSingleItem();
        votes[0].Choice.ShouldBe(VoteChoice.No);
    }

    [Fact]
    public async Task ConcurrentFirstVotes_BothSucceedIdempotently()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (token, participantId, dateOptionId) = await SeedEventWithParticipantAsync(
            ctx.Services
        );

        // Act
        var results = await Task.WhenAll(
            SafeCastVotesAsync(ctx.ApiClient, token, participantId, dateOptionId, 1),
            SafeCastVotesAsync(ctx.ApiClient, token, participantId, dateOptionId, 3)
        );

        // Assert
        results.Count(r => r == 204).ShouldBe(2);

        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        (
            await db.DateVotes.CountAsync(v =>
                v.ParticipantId == participantId && v.DateOptionId == dateOptionId
            )
        ).ShouldBe(1);
    }

    [Fact]
    public async Task CrossEventParticipantId_Returns404()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (_, participantIdA, _) = await SeedEventWithParticipantAsync(
            ctx.Services,
            "testtoken01"
        );
        var (tokenB, _, dateOptionIdB) = await SeedEventWithParticipantAsync(
            ctx.Services,
            "testtoken02"
        );

        // Act
        var ex = await Should.ThrowAsync<ApiException>(() =>
            ctx.ApiClient.CastVotesAsync(
                tokenB,
                participantIdA,
                new CastVotesRequest
                {
                    Votes = [new VoteDto { DateOptionId = dateOptionIdB, Choice = 1 }],
                }
            )
        );

        // Assert
        ex.StatusCode.ShouldBe(404);

        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        (await db.DateVotes.AnyAsync(v => v.ParticipantId == participantIdA)).ShouldBeFalse();
    }

    [Fact]
    public async Task ForeignDateOptionId_Returns400()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (_, _, dateOptionIdA) = await SeedEventWithParticipantAsync(
            ctx.Services,
            "testtoken01"
        );
        var (tokenB, participantIdB, _) = await SeedEventWithParticipantAsync(
            ctx.Services,
            "testtoken02"
        );

        // Act
        var ex = await Should.ThrowAsync<ApiException>(() =>
            ctx.ApiClient.CastVotesAsync(
                tokenB,
                participantIdB,
                new CastVotesRequest
                {
                    Votes = [new VoteDto { DateOptionId = dateOptionIdA, Choice = 1 }],
                }
            )
        );

        // Assert
        ex.StatusCode.ShouldBe(400);

        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        (await db.DateVotes.AnyAsync(v => v.ParticipantId == participantIdB)).ShouldBeFalse();
    }

    // Accepted-by-design (test-plan.md §2, Risk #2 row): within an event, knowing a
    // participant's GUID is the trust model — any caller holding the event token plus
    // another participant's GUID can act as them. Pinned here so it isn't mistaken for
    // an IDOR gap in a future review.
    [Fact]
    public async Task AnyCallerWithParticipantGuid_CanVoteAsThem_AcceptedFriendGroupTrust()
    {
        // Arrange
        await using var ctx = await fixture.CheckOutAsync();
        var (token, _, bobId, dateOptionId) = await SeedEventWithTwoParticipantsAsync(ctx.Services);

        // Act
        await ctx.ApiClient.CastVotesAsync(
            token,
            bobId,
            new CastVotesRequest
            {
                Votes = [new VoteDto { DateOptionId = dateOptionId, Choice = 1 }],
            }
        );

        // Assert
        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        var vote = await db.DateVotes.SingleAsync(v => v.ParticipantId == bobId);
        vote.Choice.ShouldBe(VoteChoice.Yes);
    }

    private static async Task<int> SafeCastVotesAsync(
        PicnivoApiClient client,
        string token,
        Guid participantId,
        Guid dateOptionId,
        int choice
    )
    {
        try
        {
            await client.CastVotesAsync(
                token,
                participantId,
                new CastVotesRequest
                {
                    Votes = [new VoteDto { DateOptionId = dateOptionId, Choice = choice }],
                }
            );
            return 204;
        }
        catch (ApiException ex)
        {
            return ex.StatusCode;
        }
    }

    private static async Task<(
        string Token,
        Guid AliceId,
        Guid BobId,
        Guid DateOptionId
    )> SeedEventWithTwoParticipantsAsync(IServiceProvider services, string token = "testtoken01")
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
            DateOptions =
            [
                dateOption,
                new DateOption
                {
                    Id = Guid.CreateVersion7(),
                    StartsAt = DateTimeOffset.UtcNow.AddDays(8),
                },
            ],
        };
        db.Events.Add(@event);

        var alice = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = @event.Id,
            DisplayName = "Alice",
            Attendance = AttendanceStatus.Undecided,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        var bob = new Participant
        {
            Id = Guid.CreateVersion7(),
            EventId = @event.Id,
            DisplayName = "Bob",
            Attendance = AttendanceStatus.Undecided,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Participants.AddRange(alice, bob);

        await db.SaveChangesAsync();
        return (token, alice.Id, bob.Id, dateOption.Id);
    }

    private static async Task<(
        string Token,
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
            DateOptions =
            [
                dateOption,
                new DateOption
                {
                    Id = Guid.CreateVersion7(),
                    StartsAt = DateTimeOffset.UtcNow.AddDays(8),
                },
            ],
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
        return (token, participant.Id, dateOption.Id);
    }
}
