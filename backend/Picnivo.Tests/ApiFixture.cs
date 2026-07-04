using System.Threading.Channels;
using EntityFramework.Exceptions.PostgreSQL;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Picnivo.API.Data;
using Picnivo.Tests.Client;
using Testcontainers.PostgreSql;

namespace Picnivo.Tests;

[CollectionDefinition("Api")]
public class ApiCollection : ICollectionFixture<ApiFixture> { }

public class ApiFixture : IAsyncLifetime
{
    private const int PoolSize = 10;

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder(
        "postgres:16-alpine"
    ).Build();
    private readonly Channel<PooledDatabase> _pool = Channel.CreateBounded<PooledDatabase>(
        PoolSize
    );

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        var databases = await Task.WhenAll(
            Enumerable.Range(0, PoolSize).Select(_ => CreateDatabaseAsync())
        );

        foreach (var db in databases)
            await _pool.Writer.WriteAsync(db);
    }

    private async Task<PooledDatabase> CreateDatabaseAsync()
    {
        var dbName = $"t{Guid.NewGuid():N}";
        var masterConnStr = _postgres.GetConnectionString();

        await using var masterConn = new NpgsqlConnection(masterConnStr);
        await masterConn.OpenAsync();
        await using (var cmd = masterConn.CreateCommand())
        {
            cmd.CommandText = $"CREATE DATABASE \"{dbName}\"";
            await cmd.ExecuteNonQueryAsync();
        }

        var testConnStr = new NpgsqlConnectionStringBuilder(masterConnStr)
        {
            Database = dbName,
        }.ConnectionString;

        await using var setupConn = new NpgsqlConnection(testConnStr);
        await setupConn.OpenAsync();

        await using (var cmd = setupConn.CreateCommand())
        {
            cmd.CommandText = """
                CREATE SCHEMA IF NOT EXISTS auth;
                CREATE TABLE IF NOT EXISTS auth.users (
                    id UUID PRIMARY KEY,
                    raw_user_meta_data JSONB
                );
                """;
            await cmd.ExecuteNonQueryAsync();
        }

        var factory = new CustomWebApplicationFactory(testConnStr);

        using var scope = factory.Services.CreateScope();
        var efDb = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        await efDb.Database.MigrateAsync();

        // Drop the auth.users FK so tests can insert Organizers directly without auth.users rows.
        await using (var cmd = setupConn.CreateCommand())
        {
            cmd.CommandText =
                """ALTER TABLE "Organizers" DROP CONSTRAINT IF EXISTS fk_organizers_auth_users""";
            await cmd.ExecuteNonQueryAsync();
        }

        return new PooledDatabase(factory, masterConnStr, testConnStr, dbName);
    }

    public async Task<PooledTestContext> CheckOutAsync()
    {
        var db = await _pool.Reader.ReadAsync();
        return new PooledTestContext(db, ReturnAsync);
    }

    private async Task ReturnAsync(PooledDatabase db)
    {
        await db.ResetAsync();
        await _pool.Writer.WriteAsync(db);
    }

    public async Task DisposeAsync()
    {
        _pool.Writer.Complete();
        await foreach (var db in _pool.Reader.ReadAllAsync())
            await db.DropAsync();
        await _postgres.DisposeAsync();
    }
}

internal sealed class PooledDatabase(
    CustomWebApplicationFactory factory,
    string masterConnStr,
    string testConnStr,
    string dbName
)
{
    public HttpClient Client { get; } = factory.CreateClient();
    public PicnivoApiClient ApiClient { get; } = new(factory.CreateClient());
    public IServiceProvider Services => factory.Services;

    public PicnivoApiClient AuthedApiClient(Guid organizerId)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.OrganizerIdHeader, organizerId.ToString());
        return new PicnivoApiClient(client);
    }

    internal async Task ResetAsync()
    {
        await using var conn = new NpgsqlConnection(testConnStr);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """TRUNCATE "Organizers" CASCADE""";
        await cmd.ExecuteNonQueryAsync();
    }

    internal async Task DropAsync()
    {
        await factory.DisposeAsync();
        await using var conn = new NpgsqlConnection(masterConnStr);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"DROP DATABASE IF EXISTS \"{dbName}\" WITH (FORCE)";
        await cmd.ExecuteNonQueryAsync();
    }
}

public sealed class PooledTestContext : IAsyncDisposable
{
    private readonly PooledDatabase _db;
    private readonly Func<PooledDatabase, Task> _return;

    internal PooledTestContext(PooledDatabase db, Func<PooledDatabase, Task> @return)
    {
        _db = db;
        _return = @return;
    }

    public HttpClient Client => _db.Client;
    public PicnivoApiClient ApiClient => _db.ApiClient;
    public IServiceProvider Services => _db.Services;

    public PicnivoApiClient AuthedApiClient(Guid organizerId) => _db.AuthedApiClient(organizerId);

    public async ValueTask DisposeAsync() => await _return(_db);
}

public class CustomWebApplicationFactory(string connectionString) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(d =>
                d.ServiceType == typeof(DbContextOptions<PicnivoDbContext>)
            );
            if (descriptor is not null)
                services.Remove(descriptor);

            services.AddDbContext<PicnivoDbContext>(options =>
                options.UseNpgsql(connectionString).UseExceptionProcessor()
            );

            services
                .AddAuthentication(TestAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                    TestAuthHandler.SchemeName,
                    _ => { }
                );
        });
    }
}
