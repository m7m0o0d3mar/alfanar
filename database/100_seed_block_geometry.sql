-- Seed GeoJSON polygon geometries for existing blocks
-- Generates rectangular building footprints based on project lat/lng
-- Each block gets a unique offset from project center with color by status

DO $$
DECLARE
    proj RECORD;
    blk RECORD;
    lat_offset DECIMAL;
    lng_offset DECIMAL;
    base_lat DECIMAL;
    base_lng DECIMAL;
    poly_width DECIMAL := 0.003;
    poly_height DECIMAL := 0.005;
    idx INT;
BEGIN
    FOR proj IN SELECT id, latitude::DECIMAL, longitude::DECIMAL
                FROM projects
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND is_active = true
    LOOP
        base_lat := proj.latitude;
        base_lng := proj.longitude;
        idx := 0;

        FOR blk IN SELECT id, block_code, status, floor_count
                   FROM blocks
                   WHERE project_id = proj.id AND geometry IS NULL
                   ORDER BY block_code
        LOOP
            idx := idx + 1;

            -- Staggered offsets so blocks don't overlap
            lat_offset := ((idx - 1) * 0.004) - 0.002;
            lng_offset := ((idx - 1) * 0.005) - 0.003;

            -- Size scales with floor_count
            IF blk.floor_count IS NOT NULL AND blk.floor_count > 0 THEN
                poly_width := 0.002 + (blk.floor_count * 0.0001);
                poly_height := 0.003 + (blk.floor_count * 0.0002);
            ELSE
                poly_width := 0.003;
                poly_height := 0.005;
            END IF;

            UPDATE blocks SET
                geometry = jsonb_build_object(
                    'type', 'Polygon',
                    'coordinates', jsonb_build_array(jsonb_build_array(
                        jsonb_build_array(base_lng + lng_offset, base_lat + lat_offset),
                        jsonb_build_array(base_lng + lng_offset + poly_width, base_lat + lat_offset),
                        jsonb_build_array(base_lng + lng_offset + poly_width, base_lat + lat_offset + poly_height),
                        jsonb_build_array(base_lng + lng_offset, base_lat + lat_offset + poly_height),
                        jsonb_build_array(base_lng + lng_offset, base_lat + lat_offset)
                    ))
                ),
                center_lat = base_lat + lat_offset + (poly_height / 2),
                center_lng = base_lng + lng_offset + (poly_width / 2),
                area_sqm = ROUND((poly_width * 111320 * COS(RADIANS(base_lat))) * (poly_height * 111320)),
                color = CASE blk.status
                    WHEN 'in_progress' THEN '#f59e0b'
                    WHEN 'planning'    THEN '#3b82f6'
                    WHEN 'completed'   THEN '#22c55e'
                    WHEN 'on_hold'     THEN '#ef4444'
                    ELSE '#8b5cf6'
                END
            WHERE id = blk.id;
        END LOOP;
    END LOOP;
END $$;
