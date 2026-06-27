using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Picnivo.API.Data.Models;

namespace Picnivo.API.Data.Configurations;

public class DateOptionConfiguration : IEntityTypeConfiguration<DateOption>
{
    public void Configure(EntityTypeBuilder<DateOption> builder)
    {
        builder.HasKey(d => d.Id);

        builder.Property(d => d.StartsAt)
            .IsRequired();
    }
}
