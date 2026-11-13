using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgriTech.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class SeedReferenceData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                -- =============================================================
                -- Master Reference Data: 4 Crops & 4 Soil Profiles
                -- =============================================================

                -- 1. Reference Crops with fixed, documented UUIDs
                INSERT INTO crops (id, common_name, scientific_name, family, default_root_depth_max_m)
                VALUES 
                    ('c0000000-0000-0000-0000-000000000001', 'Tomato', 'Solanum lycopersicum', 'Solanaceae', 0.60),
                    ('c0000000-0000-0000-0000-000000000002', 'Corn', 'Zea mays', 'Poaceae', 1.00),
                    ('c0000000-0000-0000-0000-000000000003', 'Potato', 'Solanum tuberosum', 'Solanaceae', 0.60),
                    ('c0000000-0000-0000-0000-000000000004', 'Apple', 'Malus domestica', 'Rosaceae', 1.50)
                ON CONFLICT (id) DO NOTHING;

                -- 2. Reference Soil Profiles (matching spec dropdown IDs and frontend field capacities)
                -- Sources:
                -- FAO Irrigation and Drainage Paper No. 56 (FAO-56), Table 19:
                --   'Typical values for soil water characteristics for various soil texture classes'
                -- USDA NRCS National Engineering Handbook, Part 652 (Irrigation Guide), Table 2-4:
                --   Physical and hydrological properties of soil texture groups
                -- Field capacity values: Sand=0.12, Sandy Loam=0.22, Silt=0.31, Clay=0.38
                -- Hydraulic conductivity (mm/h) and wilting point / saturation sourced from FAO-56 Table 19 / USDA NRCS.
                INSERT INTO soil_profiles (id, name, field_capacity_pct, wilting_point_pct, saturation_pct, hydraulic_conductivity, mad_threshold_pct)
                VALUES 
                    ('sand', 'Sand', 0.120, 0.050, 0.380, 50.00, 0.50),
                    ('sandy_loam', 'Sandy Loam', 0.220, 0.100, 0.430, 25.00, 0.50),
                    ('silt', 'Silt', 0.310, 0.140, 0.480, 12.50, 0.50),
                    ('clay', 'Clay', 0.380, 0.220, 0.500, 2.50, 0.50)
                ON CONFLICT (id) DO NOTHING;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE FROM soil_profiles WHERE id IN ('sand', 'sandy_loam', 'silt', 'clay');
                DELETE FROM crops WHERE id IN (
                    'c0000000-0000-0000-0000-000000000001',
                    'c0000000-0000-0000-0000-000000000002',
                    'c0000000-0000-0000-0000-000000000003',
                    'c0000000-0000-0000-0000-000000000004'
                );
            ");
        }
    }
}
