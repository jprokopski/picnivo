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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PicnivoDbContext).Assembly);
    }
}
