START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261018131932_SpatialIntegrityFunctionsAndTriggers') THEN
    ALTER TABLE parcels ADD CONSTRAINT chk_parcels_boundary_valid CHECK (ST_IsValid(boundary_geom));
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261018131932_SpatialIntegrityFunctionsAndTriggers') THEN
    ALTER TABLE fields ADD CONSTRAINT chk_fields_boundary_valid CHECK (ST_IsValid(boundary_geom));
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261018131932_SpatialIntegrityFunctionsAndTriggers') THEN

                    CREATE OR REPLACE FUNCTION fn_check_parcel_overlap(
                        p_field_id UUID,
                        p_candidate_geom GEOMETRY,
                        p_exclude_parcel_id UUID DEFAULT NULL
                    )
                    RETURNS TABLE (
                        conflicting_parcel_id UUID,
                        conflicting_parcel_name VARCHAR,
                        overlap_area_sqm NUMERIC
                    ) AS $$
                    SELECT 
                            p.id AS conflicting_parcel_id,
                            p.name AS conflicting_parcel_name,
                            ROUND(ST_Area(ST_Intersection(p.boundary_geom, p_candidate_geom)::geography)::numeric, 2) AS overlap_area_sqm
                        FROM parcels p
                        WHERE p.field_id = p_field_id
                          AND (p_exclude_parcel_id IS NULL OR p.id != p_exclude_parcel_id)
                          AND ST_Intersects(p.boundary_geom, p_candidate_geom)
                          AND NOT ST_Touches(p.boundary_geom, p_candidate_geom)
                          AND ST_Area(ST_Intersection(p.boundary_geom, p_candidate_geom)::geography) > 0.05;
                    END;
                    $$ LANGUAGE sql STABLE PARALLEL SAFE;
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261018131932_SpatialIntegrityFunctionsAndTriggers') THEN

                    CREATE OR REPLACE FUNCTION check_parcel_integrity()
                    RETURNS TRIGGER AS $$
                    DECLARE
                        v_field_geom GEOMETRY;
                        v_conflict_id UUID;
                        v_conflict_name VARCHAR;
                        v_overlap_sqm NUMERIC;
                    BEGIN
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

                    DROP TRIGGER IF EXISTS trg_enforce_parcel_integrity ON parcels;
                    CREATE TRIGGER trg_enforce_parcel_integrity
                    BEFORE INSERT OR UPDATE OF boundary_geom, field_id ON parcels
                    FOR EACH ROW EXECUTE FUNCTION check_parcel_integrity();
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261018131932_SpatialIntegrityFunctionsAndTriggers') THEN

                    CREATE OR REPLACE FUNCTION fn_locate_parcel_by_coordinate(
                        p_longitude DOUBLE PRECISION,
                        p_latitude DOUBLE PRECISION
                    )
                    RETURNS TABLE (
                        parcel_id UUID,
                        parcel_name VARCHAR,
                        field_id UUID,
                        field_name VARCHAR,
                        crop_id UUID,
                        crop_name VARCHAR,
                        soil_profile_id VARCHAR,
                        soil_profile_name VARCHAR,
                        planting_date DATE,
                        area_hectares NUMERIC,
                        kc_current NUMERIC
                    ) AS $$
                    SELECT 
                            p.id AS parcel_id,
                            p.name AS parcel_name,
                            f.id AS field_id,
                            f.name AS field_name,
                            c.id AS crop_id,
                            c.common_name AS crop_name,
                            s.id AS soil_profile_id,
                            s.name AS soil_profile_name,
                            p.planting_date,
                            p.area_hectares,
                            p.kc_current
                        FROM parcels p
                        JOIN fields f ON p.field_id = f.id
                        JOIN crops c ON p.crop_id = c.id
                        JOIN soil_profiles s ON p.soil_profile_id = s.id
                        WHERE ST_Contains(p.boundary_geom, ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326))
                        LIMIT 1;
                    $$ LANGUAGE sql STABLE PARALLEL SAFE;
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261018131932_SpatialIntegrityFunctionsAndTriggers') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261018131932_SpatialIntegrityFunctionsAndTriggers', '10.0.13');
    END IF;
END $EF$;
COMMIT;

