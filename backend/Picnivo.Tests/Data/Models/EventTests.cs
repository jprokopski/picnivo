using Picnivo.API.Data.Models;

namespace Picnivo.Tests.Data.Models;

public class EventTests
{
    [Fact]
    public void ResolveBestDateOptionId_RanksByMostYesVotes()
    {
        // Arrange
        var lowYes = Guid.CreateVersion7();
        var highYes = Guid.CreateVersion7();
        var now = DateTimeOffset.UtcNow;
        DateOptionTally[] tallies =
        [
            new(lowYes, now.AddDays(1), YesCount: 1, NoCount: 0),
            new(highYes, now.AddDays(2), YesCount: 3, NoCount: 0),
        ];

        // Act
        var best = Event.ResolveBestDateOptionId(tallies);

        // Assert
        best.ShouldBe(highYes);
    }

    [Fact]
    public void ResolveBestDateOptionId_TiedYesVotes_PrefersFewestNoVotes()
    {
        // Arrange
        var moreNo = Guid.CreateVersion7();
        var fewerNo = Guid.CreateVersion7();
        var now = DateTimeOffset.UtcNow;
        DateOptionTally[] tallies =
        [
            new(moreNo, now.AddDays(1), YesCount: 2, NoCount: 2),
            new(fewerNo, now.AddDays(2), YesCount: 2, NoCount: 0),
        ];

        // Act
        var best = Event.ResolveBestDateOptionId(tallies);

        // Assert
        best.ShouldBe(fewerNo);
    }

    [Fact]
    public void ResolveBestDateOptionId_TiedYesAndNoVotes_PrefersEarliestStartsAt()
    {
        // Arrange
        var later = Guid.CreateVersion7();
        var earlier = Guid.CreateVersion7();
        var now = DateTimeOffset.UtcNow;
        DateOptionTally[] tallies =
        [
            new(later, now.AddDays(5), YesCount: 2, NoCount: 1),
            new(earlier, now.AddDays(1), YesCount: 2, NoCount: 1),
        ];

        // Act
        var best = Event.ResolveBestDateOptionId(tallies);

        // Assert
        best.ShouldBe(earlier);
    }

    [Fact]
    public void ResolveBestDateOptionId_NoDateOptions_ReturnsNull()
    {
        // Arrange
        DateOptionTally[] tallies = [];

        // Act
        var best = Event.ResolveBestDateOptionId(tallies);

        // Assert
        best.ShouldBeNull();
    }
}
