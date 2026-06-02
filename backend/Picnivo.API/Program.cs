using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddOpenApi();
builder.Services.AddDbContext<PicnivoDbContext>(options =>
    options.UseNpgsql(connectionString));

var app = builder.Build();

if (string.IsNullOrEmpty(connectionString))
    throw new InvalidOperationException(
        "Database connection string 'DefaultConnection' is not configured. " +
        "Set ConnectionStrings__DefaultConnection as an environment variable or in appsettings.");

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/healthz", () => Results.Ok("healthy"));

app.Run();
