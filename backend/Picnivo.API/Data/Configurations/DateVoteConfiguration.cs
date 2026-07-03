using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Picnivo.API.Data.Models;

namespace Picnivo.API.Data.Configurations;

public class DateVoteConfiguration : IEntityTypeConfiguration<DateVote>
{
    public void Configure(EntityTypeBuilder<DateVote> builder)
    {
        builder.HasKey(v => v.Id);

        builder.Property(v => v.Choice)
            .IsRequired();

        builder.HasIndex(v => new { v.ParticipantId, v.DateOptionId })
            .IsUnique()
            .HasDatabaseName("IX_DateVotes_Participant_DateOption");

        builder.HasOne(v => v.DateOption)
            .WithMany()
            .HasForeignKey(v => v.DateOptionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
