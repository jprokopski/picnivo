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
    }
}
