using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data.Models;

namespace Picnivo.API.Data;

public class PicnivoDbContext : DbContext
{
    public PicnivoDbContext(DbContextOptions<PicnivoDbContext> options)
        : base(options)
    {
    }

    public DbSet<Event> Events => Set<Event>();
    public DbSet<Organizer> Organizers => Set<Organizer>();
    public DbSet<DateOption> DateOptions => Set<DateOption>();
    public DbSet<EventItem> EventItems => Set<EventItem>();
    public DbSet<Participant> Participants => Set<Participant>();
    public DbSet<DateVote> DateVotes => Set<DateVote>();
    public DbSet<ItemClaim> ItemClaims => Set<ItemClaim>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PicnivoDbContext).Assembly);
    }
}
