using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Picnivo.API.Data.Models;

namespace Picnivo.API.Data.Configurations;

public class ItemClaimConfiguration : IEntityTypeConfiguration<ItemClaim>
{
    public void Configure(EntityTypeBuilder<ItemClaim> builder)
    {
        builder.HasKey(c => c.Id);

        builder.Property(c => c.ClaimedAt).HasDefaultValueSql("now()");

        builder.HasIndex(c => c.EventItemId).IsUnique().HasDatabaseName("IX_ItemClaims_EventItem");

        builder
            .HasOne(c => c.EventItem)
            .WithOne(i => i.Claim)
            .HasForeignKey<ItemClaim>(c => c.EventItemId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
