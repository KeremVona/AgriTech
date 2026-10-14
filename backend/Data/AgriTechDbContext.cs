using Microsoft.EntityFrameworkCore;

namespace AgriTech.Api.Data;

public class AgriTechDbContext : DbContext
{
    public AgriTechDbContext(DbContextOptions<AgriTechDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);


        // 1. PostGIS mekânsal eklentisi (Geometry, ST_Contains, ST_Area vb.)
        modelBuilder.HasPostgresExtension("postgis");

        // 2. UUID üretim fonksiyonları (uuid_generate_v4())
        modelBuilder.HasPostgresExtension("uuid-ossp");

    }
}