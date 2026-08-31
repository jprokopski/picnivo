using System.Security.Claims;
using EntityFramework.Exceptions.PostgreSQL;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Picnivo.API;
using Picnivo.API.Data;
using Picnivo.API.ExceptionHandling;
using Picnivo.API.Features.Streaming;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddOpenApi();
builder.Services.AddValidatorsFromAssemblyContaining<Program>();
builder.Services.AddDbContext<PicnivoDbContext>(options =>
    options.UseNpgsql(connectionString).UseExceptionProcessor()
);
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.Configure<StreamingOptions>(
    builder.Configuration.GetSection(StreamingOptions.SectionName)
);
builder.Services.AddSingleton<IEventStreamBroker, EventStreamBroker>();

var frontendUrl = builder.Configuration["Frontend:Url"];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var origins = new List<string> { "http://localhost:3000" };
        if (!string.IsNullOrEmpty(frontendUrl))
        {
            origins.Add(frontendUrl);
        }

        policy.WithOrigins(origins.ToArray()).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
    });
});

builder
    .Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
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

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseExceptionHandler();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/healthz", () => Results.Ok("healthy"));

app.MapGet("/api/me", (ClaimsPrincipal user) => Results.Ok(new { id = user.FindFirstValue("sub") }))
    .RequireAuthorization();

app.MapEndpoints();

app.Run();
