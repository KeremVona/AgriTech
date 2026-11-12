using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgriTech.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class FixParcelOverlapIntegrityAndLocking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Finding 4: Remake check_parcel_integrity() with transactional advisory lock per parent field
            // to serialize concurrent parcel inserts/updates within the same field.
            migrationBuilder.Sql(@"
                CREATE OR REPLACE FUNCTION check_parcel_integrity()
                RETURNS TRIGGER AS $$
                DECLARE
                    v_field_geom GEOMETRY;
                    v_conflict_id UUID;
                    v_conflict_name VARCHAR;
                    v_overlap_sqm NUMERIC;
                BEGIN
                    -- Serialise parcel writes per field to prevent race conditions on concurrent inserts (Finding 4)
                    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.field_id::text, 0));

                    -- A. Self-intersection & geometric validity verification
                    IF NOT ST_IsValid(NEW.boundary_geom) THEN
                        RAISE EXCEPTION 'Geometric integrity violation: Parcel polygon is invalid or self-intersecting. Detail: %', ST_IsValidReason(NEW.boundary_geom);
                    END IF;

                    -- B. Spatial containment verification within parent field boundary
                    SELECT boundary_geom INTO v_field_geom FROM fields WHERE id = NEW.field_id;
                    IF v_field_geom IS NOT NULL AND NOT ST_Covers(v_field_geom, NEW.boundary_geom) THEN
                        RAISE EXCEPTION 'Spatial containment violation: Parcel boundary is not completely contained within parent field %', NEW.field_id;
                    END IF;

                    -- C. Topological collision prevention (Reject overlapping candidate parcels)
                    SELECT 
                        p.id, 
                        p.name, 
                        ROUND(ST_Area(ST_Intersection(p.boundary_geom, NEW.boundary_geom)::geography)::numeric, 2)
                    INTO v_conflict_id, v_conflict_name, v_overlap_sqm
                    FROM parcels p
                    WHERE p.field_id = NEW.field_id
                      AND (NEW.id IS NULL OR p.id != NEW.id)
                      AND ST_Intersects(p.boundary_geom, NEW.boundary_geom)
                      AND NOT ST_Touches(p.boundary_geom, NEW.boundary_geom)
                      AND ST_Area(ST_Intersection(p.boundary_geom, NEW.boundary_geom)::geography) > 0.05
                    LIMIT 1;

                    IF v_conflict_id IS NOT NULL THEN
                        RAISE EXCEPTION 'Topological collision error: Candidate parcel overlaps with existing parcel % (%) by % m²', v_conflict_id, v_conflict_name, v_overlap_sqm;
                    END IF;

                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Restore previous trigger definition without advisory lock
            migrationBuilder.Sql(@"
                CREATE OR REPLACE FUNCTION check_parcel_integrity()
                RETURNS TRIGGER AS $$
                DECLARE
                    v_field_geom GEOMETRY;
                    v_conflict_id UUID;
                    v_conflict_name VARCHAR;
                    v_overlap_sqm NUMERIC;
                BEGIN
                    IF NOT ST_IsValid(NEW.boundary_geom) THEN
                        RAISE EXCEPTION 'Geometric integrity violation: Parcel polygon is invalid or self-intersecting. Detail: %', ST_IsValidReason(NEW.boundary_geom);
                    END IF;

                    SELECT boundary_geom INTO v_field_geom FROM fields WHERE id = NEW.field_id;
                    IF v_field_geom IS NOT NULL AND NOT ST_Covers(v_field_geom, NEW.boundary_geom) THEN
                        RAISE EXCEPTION 'Spatial containment violation: Parcel boundary is not completely contained within parent field %', NEW.field_id;
                    END IF;

                    SELECT 
                        p.id, 
                        p.name, 
                        ROUND(ST_Area(ST_Intersection(p.boundary_geom, NEW.boundary_geom)::geography)::numeric, 2)
                    INTO v_conflict_id, v_conflict_name, v_overlap_sqm
                    FROM parcels p
                    WHERE p.field_id = NEW.field_id
                      AND (NEW.id IS NULL OR p.id != NEW.id)
                      AND ST_Intersects(p.boundary_geom, NEW.boundary_geom)
                      AND NOT ST_Touches(p.boundary_geom, NEW.boundary_geom)
                      AND ST_Area(ST_Intersection(p.boundary_geom, NEW.boundary_geom)::geography) > 0.05
                    LIMIT 1;

                    IF v_conflict_id IS NOT NULL THEN
                        RAISE EXCEPTION 'Topological collision error: Candidate parcel overlaps with existing parcel % (%) by % m²', v_conflict_id, v_conflict_name, v_overlap_sqm;
                    END IF;

                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            ");
        }
    }
}
