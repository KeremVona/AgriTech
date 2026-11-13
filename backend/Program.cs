using AgriTech.Api.Data;
using AgriTech.Api.Extensions;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Configure ASP.NET Core Controllers with NetTopologySuite GeoJSON serialization (RFC 7946, SRID 4326)
builder.Services.AddControllers()
    .AddGeoJsonSerialization(srid: GeoJsonSerializationExtensions.DefaultSpatialReferenceId);

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowLocalhost", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// DbContext (PostgreSQL + NetTopologySuite spatial provider)
builder.Services.AddDbContext<AgriTechDbContext>(options => 
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        npgsqlOptions => npgsqlOptions.UseNetTopologySuite()));

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    // D2: Automatically apply pending EF Core migrations at backend start-up in Development
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<AgriTechDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogInformation("Applying EF Core migrations at start-up (Development environment)...");
        db.Database.Migrate();
        logger.LogInformation("EF Core migrations applied successfully.");

        // Finding 2: Seed development farm owner with fixed UUID in Development only (never in production)
        var devOwnerId = Guid.Parse("a0000000-0000-0000-0000-000000000001");
        if (!db.Users.Any(u => u.Id == devOwnerId))
        {
            logger.LogInformation("Seeding development owner user ({UserId})...", devOwnerId);
            db.Users.Add(new AgriTech.Api.Models.User
            {
                Id = devOwnerId,
                Email = "dev-owner@agritech.local",
                FullName = "Development Farm Owner",
                Role = "FARM_OWNER",
                PhoneNumber = "+905550000001",
                IsActive = true
            });
            db.SaveChanges();
            logger.LogInformation("Development owner user seeded successfully.");
        }
    }
}
// NOTE (Production Deployment): In Production environments, do NOT execute automatic runtime migrations.
// Instead, apply migrations out-of-band as an automated CI/CD deployment step:
// `dotnet ef database update --connection "<ProductionConnectionString>"`

// Global exception handling: translates NetTopologySuite geometry/deserialization exceptions to 400 Bad Request
app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (Exception ex) when (ex is ArgumentException or NetTopologySuite.Geometries.TopologyException or System.Text.Json.JsonException)
    {
        if (!context.Response.HasStarted)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            context.Response.ContentType = "application/problem+json";
            var problem = new Microsoft.AspNetCore.Mvc.ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Invalid geometry or request payload",
                Detail = ex.Message
            };
            await context.Response.WriteAsJsonAsync(problem);
        }
    }
});

app.UseCors("AllowLocalhost");

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
