using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Picnivo.API.Data;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddOpenApi();
builder.Services.AddDbContext<PicnivoDbContext>(options =>
    options.UseNpgsql(connectionString));

var frontendUrl = builder.Configuration["Frontend:Url"];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var origins = new List<string> { "http://localhost:3000" };
        if (!string.IsNullOrEmpty(frontendUrl))
            origins.Add(frontendUrl);

        policy.WithOrigins(origins.ToArray())
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = builder.Configuration["Supabase:Authority"];
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
        options.TokenValidationParameters = new()
        {
            ValidAlgorithms = ["ES256"],
            ValidAudience = "authenticated",
        };
        options.MapInboundClaims = false;
    });

builder.Services.AddAuthorizationBuilder();

var app = builder.Build();

if (string.IsNullOrEmpty(connectionString))
    throw new InvalidOperationException(
        "Database connection string 'DefaultConnection' is not configured. " +
        "Set ConnectionStrings__DefaultConnection as an environment variable or in appsettings.");

if (string.IsNullOrEmpty(builder.Configuration["Supabase:Authority"]))
    throw new InvalidOperationException(
        "Supabase Authority is not configured. " +
        "Set Supabase__Authority as an environment variable or in appsettings.");

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/healthz", () => Results.Ok("healthy"));

app.MapGet("/api/me", (ClaimsPrincipal user) =>
    Results.Ok(new { id = user.FindFirstValue("sub") }))
    .RequireAuthorization();

app.Run();
