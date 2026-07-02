using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Picnivo.API.Data.Models;

namespace Picnivo.API.Data.Configurations;

public class EventItemConfiguration : IEntityTypeConfiguration<EventItem>
{
    public void Configure(EntityTypeBuilder<EventItem> builder)
    {
        builder.HasKey(i => i.Id);

        builder.Property(i => i.Label)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property<string>("NormalizedLabel")
            .HasComputedColumnSql("lower(\"Label\")", stored: true);

        builder.HasIndex("EventId", "NormalizedLabel")
            .IsUnique()
            .HasDatabaseName("IX_EventItems_Event_NormalizedLabel");

        builder.HasOne(i => i.AddedByParticipant)
            .WithMany()
            .HasForeignKey(i => i.AddedByParticipantId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(i => i.OrphanedFromParticipant)
            .WithMany()
            .HasForeignKey(i => i.OrphanedFromParticipantId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
