using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Picnivo.API.Data.Models;

namespace Picnivo.API.Data.Configurations;

public class ParticipantConfiguration : IEntityTypeConfiguration<Participant>
{
    public void Configure(EntityTypeBuilder<Participant> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.DisplayName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(p => p.Attendance)
            .IsRequired();

        builder.Property(p => p.IsOrganizer)
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(p => p.CreatedAt)
            .HasDefaultValueSql("now()");

        builder.HasMany(p => p.Votes)
            .WithOne(v => v.Participant)
            .HasForeignKey(v => v.ParticipantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(p => p.Claims)
            .WithOne(c => c.Participant)
            .HasForeignKey(c => c.ParticipantId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
