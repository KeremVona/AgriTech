using AgriTech.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AgriTech.Api.Data;

public class AgriTechDbContext : DbContext
{
    public AgriTechDbContext(DbContextOptions<AgriTechDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Crop> Crops => Set<Crop>();
    public DbSet<SoilProfile> SoilProfiles => Set<SoilProfile>();
    public DbSet<Field> Fields => Set<Field>();
    public DbSet<Parcel> Parcels => Set<Parcel>();
    public DbSet<SensorNode> SensorNodes => Set<SensorNode>();
    public DbSet<ModelInference> ModelInferences => Set<ModelInference>();
    public DbSet<CropScan> CropScans => Set<CropScan>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // 1. PostGIS & UUID Extensions
        modelBuilder.HasPostgresExtension("postgis");
        modelBuilder.HasPostgresExtension("uuid-ossp");

        // 2. User Configuration
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(u => u.Id);
            entity.Property(u => u.Id).HasColumnName("id").HasDefaultValueSql("uuid_generate_v4()");
            entity.Property(u => u.Email).HasColumnName("email").HasMaxLength(255).IsRequired();
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.FullName).HasColumnName("full_name").HasMaxLength(120).IsRequired();
            entity.Property(u => u.Role).HasColumnName("role").HasMaxLength(30).IsRequired();
            entity.Property(u => u.PhoneNumber).HasColumnName("phone_number").HasMaxLength(30);
            entity.Property(u => u.IsActive).HasColumnName("is_active").HasDefaultValue(true);
            entity.Property(u => u.MadeAt).HasColumnName("made_at").HasDefaultValueSql("now()");
            entity.Property(u => u.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("now()");
        });

        // 3. Crop Configuration
        modelBuilder.Entity<Crop>(entity =>
        {
            entity.ToTable("crops");
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Id).HasColumnName("id").HasDefaultValueSql("uuid_generate_v4()");
            entity.Property(c => c.CommonName).HasColumnName("common_name").HasMaxLength(80).IsRequired();
            entity.HasIndex(c => c.CommonName).IsUnique();
            entity.Property(c => c.ScientificName).HasColumnName("scientific_name").HasMaxLength(120);
            entity.Property(c => c.Family).HasColumnName("family").HasMaxLength(80);
            entity.Property(c => c.DefaultRootDepthMaxM).HasColumnName("default_root_depth_max_m").HasPrecision(3, 2).HasDefaultValue(0.60m);
            entity.Property(c => c.MadeAt).HasColumnName("made_at").HasDefaultValueSql("now()");
        });

        // 4. SoilProfile Configuration
        modelBuilder.Entity<SoilProfile>(entity =>
        {
            entity.ToTable("soil_profiles");
            entity.HasKey(s => s.Id);
            entity.Property(s => s.Id).HasColumnName("id").HasMaxLength(40);
            entity.Property(s => s.Name).HasColumnName("name").HasMaxLength(80).IsRequired();
            entity.Property(s => s.FieldCapacityPct).HasColumnName("field_capacity_pct").HasPrecision(4, 3).IsRequired();
            entity.Property(s => s.WiltingPointPct).HasColumnName("wilting_point_pct").HasPrecision(4, 3).IsRequired();
            entity.Property(s => s.SaturationPct).HasColumnName("saturation_pct").HasPrecision(4, 3).IsRequired();
            entity.Property(s => s.HydraulicConductivity).HasColumnName("hydraulic_conductivity").HasPrecision(6, 2).IsRequired();
            entity.Property(s => s.MadThresholdPct).HasColumnName("mad_threshold_pct").HasPrecision(3, 2).HasDefaultValue(0.50m);
        });

        // 5. Field Configuration (Spatial Polygon + GiST Index)
        modelBuilder.Entity<Field>(entity =>
        {
            entity.ToTable("fields");
            entity.HasKey(f => f.Id);
            entity.Property(f => f.Id).HasColumnName("id").HasDefaultValueSql("uuid_generate_v4()");
            entity.Property(f => f.OwnerId).HasColumnName("owner_id").IsRequired();
            entity.Property(f => f.Name).HasColumnName("name").HasMaxLength(120).IsRequired();
            entity.Property(f => f.BoundaryGeom).HasColumnName("boundary_geom").HasColumnType("geometry(Polygon, 4326)").IsRequired();
            entity.Property(f => f.TotalAreaHectares).HasColumnName("total_area_hectares").HasPrecision(8, 2).HasDefaultValue(0.00m);
            entity.Property(f => f.LocationName).HasColumnName("location_name").HasMaxLength(150);
            entity.Property(f => f.MadeAt).HasColumnName("made_at").HasDefaultValueSql("now()");
            entity.Property(f => f.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("now()");

            // GiST Spatial Index
            entity.HasIndex(f => f.BoundaryGeom).HasMethod("gist").HasDatabaseName("idx_fields_boundary");

            // Foreign Key: User -> Fields (CASCADE)
            entity.HasOne(f => f.Owner)
                  .WithMany(u => u.Fields)
                  .HasForeignKey(f => f.OwnerId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // 6. Parcel Configuration (Spatial Polygon + GiST Index + Area Trigger Target)
        modelBuilder.Entity<Parcel>(entity =>
        {
            entity.ToTable("parcels");
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Id).HasColumnName("id").HasDefaultValueSql("uuid_generate_v4()");
            entity.Property(p => p.FieldId).HasColumnName("field_id").IsRequired();
            entity.Property(p => p.CropId).HasColumnName("crop_id").IsRequired();
            entity.Property(p => p.SoilProfileId).HasColumnName("soil_profile_id").HasMaxLength(40).IsRequired();
            entity.Property(p => p.Name).HasColumnName("name").HasMaxLength(80).IsRequired();
            entity.Property(p => p.BoundaryGeom).HasColumnName("boundary_geom").HasColumnType("geometry(Polygon, 4326)").IsRequired();
            entity.Property(p => p.AreaHectares).HasColumnName("area_hectares").HasPrecision(8, 2).HasDefaultValue(0.00m);
            entity.Property(p => p.PlantingDate).HasColumnName("planting_date").IsRequired();
            entity.Property(p => p.KcCurrent).HasColumnName("kc_current").HasPrecision(3, 2).HasDefaultValue(0.40m);
            entity.Property(p => p.IrrigationMethod).HasColumnName("irrigation_method").HasMaxLength(30).HasDefaultValue("DRIP");
            entity.Property(p => p.SystemFlowRateLpm).HasColumnName("system_flow_rate_lpm").HasPrecision(8, 2).HasDefaultValue(100.00m);
            entity.Property(p => p.IrrigationEfficiency).HasColumnName("irrigation_efficiency").HasPrecision(3, 2).HasDefaultValue(0.88m);
            entity.Property(p => p.MadeAt).HasColumnName("made_at").HasDefaultValueSql("now()");
            entity.Property(p => p.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("now()");

            // GiST Spatial Index
            entity.HasIndex(p => p.BoundaryGeom).HasMethod("gist").HasDatabaseName("idx_parcels_boundary");

            // Foreign Key: Field -> Parcels (CASCADE)
            entity.HasOne(p => p.Field)
                  .WithMany(f => f.Parcels)
                  .HasForeignKey(p => p.FieldId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(p => p.Crop)
                  .WithMany(c => c.Parcels)
                  .HasForeignKey(p => p.CropId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(p => p.SoilProfile)
                  .WithMany(s => s.Parcels)
                  .HasForeignKey(p => p.SoilProfileId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // 7. SensorNode Configuration (Spatial Point + GiST Index)
        modelBuilder.Entity<SensorNode>(entity =>
        {
            entity.ToTable("sensor_nodes");
            entity.HasKey(s => s.Id);
            entity.Property(s => s.Id).HasColumnName("id").HasDefaultValueSql("uuid_generate_v4()");
            entity.Property(s => s.ParcelId).HasColumnName("parcel_id").IsRequired();
            entity.Property(s => s.HardwareUid).HasColumnName("hardware_uid").HasMaxLength(64).IsRequired();
            entity.HasIndex(s => s.HardwareUid).IsUnique();
            entity.Property(s => s.Name).HasColumnName("name").HasMaxLength(80).IsRequired();
            entity.Property(s => s.GeomPoint).HasColumnName("geom_point").HasColumnType("geometry(Point, 4326)").IsRequired();
            entity.Property(s => s.IsVirtual).HasColumnName("is_virtual").HasDefaultValue(true);
            entity.Property(s => s.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("ACTIVE");
            entity.Property(s => s.BatteryLevelPct).HasColumnName("battery_level_pct").HasPrecision(4, 1);
            entity.Property(s => s.InstalledAt).HasColumnName("installed_at").HasDefaultValueSql("now()");
            entity.Property(s => s.LastTelemetryAt).HasColumnName("last_telemetry_at");

            // GiST Spatial Index
            entity.HasIndex(s => s.GeomPoint).HasMethod("gist").HasDatabaseName("idx_sensor_nodes_point");

            // Foreign Key: Parcel -> SensorNodes (CASCADE)
            entity.HasOne(s => s.Parcel)
                  .WithMany(p => p.SensorNodes)
                  .HasForeignKey(s => s.ParcelId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // 8. ModelInference Configuration
        modelBuilder.Entity<ModelInference>(entity =>
        {
            entity.ToTable("model_inferences");
            entity.HasKey(m => m.Id);
            entity.Property(m => m.Id).HasColumnName("id").HasDefaultValueSql("uuid_generate_v4()");
            entity.Property(m => m.PredictedDiseaseId).HasColumnName("predicted_disease_id").IsRequired();
            entity.Property(m => m.ModelVersion).HasColumnName("model_version").HasMaxLength(50).IsRequired();
            entity.Property(m => m.ConfidenceScore).HasColumnName("confidence_score").HasPrecision(5, 4).IsRequired();
            entity.Property(m => m.ClassProbabilities).HasColumnName("class_probabilities").HasColumnType("jsonb").IsRequired();
            entity.Property(m => m.InferenceTimeMs).HasColumnName("inference_time_ms").IsRequired();
            entity.Property(m => m.MadeAt).HasColumnName("made_at").HasDefaultValueSql("now()");
        });

        // 9. CropScan Configuration (Spatial Point + GiST Index + SET NULL cascade)
        modelBuilder.Entity<CropScan>(entity =>
        {
            entity.ToTable("crop_scans");
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Id).HasColumnName("id").HasDefaultValueSql("uuid_generate_v4()");
            entity.Property(c => c.ParcelId).HasColumnName("parcel_id");
            entity.Property(c => c.InferenceId).HasColumnName("inference_id").IsRequired();
            entity.Property(c => c.UploadedByUserId).HasColumnName("uploaded_by_user_id");
            entity.Property(c => c.ImageUrl).HasColumnName("image_url").IsRequired();
            entity.Property(c => c.GeomPoint).HasColumnName("geom_point").HasColumnType("geometry(Point, 4326)").IsRequired();
            entity.Property(c => c.GpsAccuracyMeters).HasColumnName("gps_accuracy_meters").HasPrecision(5, 2);
            entity.Property(c => c.DetectionSource).HasColumnName("detection_source").HasMaxLength(30).HasDefaultValue("EXIF_GPS");
            entity.Property(c => c.FieldNotes).HasColumnName("field_notes");
            entity.Property(c => c.ScannedAt).HasColumnName("scanned_at").HasDefaultValueSql("now()");

            // GiST Spatial Index
            entity.HasIndex(c => c.GeomPoint).HasMethod("gist").HasDatabaseName("idx_crop_scans_point");

            // Foreign Key: Parcel -> CropScans (SET NULL)
            entity.HasOne(c => c.Parcel)
                  .WithMany(p => p.CropScans)
                  .HasForeignKey(c => c.ParcelId)
                  .OnDelete(DeleteBehavior.SetNull);

            // Foreign Key: ModelInference -> CropScans (CASCADE)
            entity.HasOne(c => c.Inference)
                  .WithMany(m => m.CropScans)
                  .HasForeignKey(c => c.InferenceId)
                  .OnDelete(DeleteBehavior.Cascade);

            // Foreign Key: User -> CropScans (SET NULL)
            entity.HasOne(c => c.UploadedByUser)
                  .WithMany(u => u.UploadedCropScans)
                  .HasForeignKey(c => c.UploadedByUserId)
                  .OnDelete(DeleteBehavior.SetNull);
        });
    }
}