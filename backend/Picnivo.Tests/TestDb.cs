using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;
using Picnivo.API.Data.Models;

namespace Picnivo.Tests;

internal static class TestDb
{
    // Creates an isolated named in-memory SQLite context with EnsureCreated already called.
    // The returned context owns the connection and disposes it on DisposeAsync.
    internal static PicnivoDbContext Create()
    {
        var conn = new SqliteConnection($"Data Source={Guid.NewGuid():N};Mode=Memory;Cache=Shared");
        conn.Open();
        var opts = new DbContextOptionsBuilder<PicnivoDbContext>().UseSqlite(conn).Options;
        var db = new SqlitePicnivoDbContext(opts, conn);
        db.Database.EnsureCreated();
        return db;
    }

    private sealed class SqlitePicnivoDbContext(
        DbContextOptions<PicnivoDbContext> opts,
        SqliteConnection conn) : PicnivoDbContext(opts)
    {
        protected override void OnModelCreating(ModelBuilder mb)
        {
            base.OnModelCreating(mb);
            // SQLite has no now() function. Remove SQL defaults so EF Core includes
            // CreatedAt in INSERT statements using whatever C# value the entity has.
            mb.Entity<Event>().Property(e => e.CreatedAt).HasDefaultValueSql(null);
            mb.Entity<Organizer>().Property(o => o.CreatedAt).HasDefaultValueSql(null);
        }

        public override void Dispose()
        {
            base.Dispose();
            conn.Dispose();
        }

        public override async ValueTask DisposeAsync()
        {
            await base.DisposeAsync();
            await conn.DisposeAsync();
        }
    }
}
