-- Seed test geometries for existing projects
-- Generates building footprints, floors, and units as GeoJSON polygons

DO $$
DECLARE
    proj RECORD;
    site_id UUID;
    bldg_id UUID;
    floor_id UUID;
    lat_offset DECIMAL;
    lng_offset DECIMAL;
    base_lat DECIMAL;
    base_lng DECIMAL;
    bldg_idx INT;
    floor_idx INT;
    unit_idx INT;
    unit_count INT;
    bldg_count INT;
    floor_count INT;
    bldg_label TEXT;
    floor_label TEXT;
    unit_label TEXT;
    sale_statuses TEXT[] := ARRAY['available', 'available', 'available', 'reserved', 'sold'];
    bldg_names TEXT[] := ARRAY['A', 'B', 'C', 'D'];
    bldg_name_en TEXT[] := ARRAY['Building A', 'Building B', 'Building C', 'Building D'];
    unit_types TEXT[] := ARRAY['1BR', '2BR', '3BR', 'Studio', 'Penthouse'];
BEGIN
    FOR proj IN SELECT id, name_en, latitude::DECIMAL, longitude::DECIMAL, project_code
                FROM projects
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND is_active = true
                LIMIT 10
    LOOP
        base_lat := proj.latitude;
        base_lng := proj.longitude;

        -- 1. Site boundary (larger polygon around the project)
        INSERT INTO project_geometries (project_id, geometry_type, label_en, label_ar, geometry, properties, level, sort_order)
        VALUES (
            proj.id, 'site',
            proj.name_en, NULL,
            jsonb_build_object(
                'type', 'Polygon',
                'coordinates', jsonb_build_array(jsonb_build_array(
                    jsonb_build_array(base_lng - 0.008, base_lat - 0.008),
                    jsonb_build_array(base_lng + 0.008, base_lat - 0.008),
                    jsonb_build_array(base_lng + 0.008, base_lat + 0.008),
                    jsonb_build_array(base_lng - 0.008, base_lat + 0.008),
                    jsonb_build_array(base_lng - 0.008, base_lat - 0.008)
                ))
            ),
            jsonb_build_object('area', 6400, 'units', 0),
            0, 0
        );

        -- 2. Buildings (2-4 per project)
        bldg_count := 2 + floor(random() * 3)::INT; -- 2-4 buildings

        FOR bldg_idx IN 1..bldg_count LOOP
            lat_offset := (bldg_idx * 0.0035) - 0.005;
            lng_offset := (bldg_idx * 0.0035) - 0.005;
            bldg_label := bldg_name_en[bldg_idx];

            INSERT INTO project_geometries (project_id, geometry_type, label_en, geometry, properties, level, sort_order)
            VALUES (
                proj.id, 'building', bldg_label,
                jsonb_build_object(
                    'type', 'Polygon',
                    'coordinates', jsonb_build_array(jsonb_build_array(
                        jsonb_build_array(base_lng + lng_offset, base_lat + lat_offset),
                        jsonb_build_array(base_lng + lng_offset + 0.003, base_lat + lat_offset),
                        jsonb_build_array(base_lng + lng_offset + 0.003, base_lat + lat_offset + 0.004),
                        jsonb_build_array(base_lng + lng_offset, base_lat + lat_offset + 0.004),
                        jsonb_build_array(base_lng + lng_offset, base_lat + lat_offset)
                    ))
                ),
                jsonb_build_object(
                    'area', 1200, 'height', 24 + (bldg_idx * 3),
                    'floors', 4 + bldg_idx, 'units', (4 + bldg_idx) * 4
                ),
                1, bldg_idx
            ) RETURNING id INTO bldg_id;

            -- 3. Floors (4-6 per building)
            floor_count := 4 + bldg_idx;
            FOR floor_idx IN 1..floor_count LOOP
                floor_label := 'Floor ' || floor_idx;
                INSERT INTO project_geometries (project_id, parent_id, geometry_type, label_en, geometry, properties, level, sort_order)
                VALUES (
                    proj.id, bldg_id, 'floor', floor_label,
                    jsonb_build_object(
                        'type', 'Polygon',
                        'coordinates', jsonb_build_array(jsonb_build_array(
                            jsonb_build_array(base_lng + lng_offset + 0.0002, base_lat + lat_offset + 0.0002),
                            jsonb_build_array(base_lng + lng_offset + 0.0028, base_lat + lat_offset + 0.0002),
                            jsonb_build_array(base_lng + lng_offset + 0.0028, base_lat + lat_offset + 0.0038),
                            jsonb_build_array(base_lng + lng_offset + 0.0002, base_lat + lat_offset + 0.0038),
                            jsonb_build_array(base_lng + lng_offset + 0.0002, base_lat + lat_offset + 0.0002)
                        ))
                    ),
                    jsonb_build_object('area', 260, 'height', 3),
                    2, floor_idx
                ) RETURNING id INTO floor_id;

                -- 4. Units (4-8 per floor)
                unit_count := 4 + (floor_idx % 3);
                FOR unit_idx IN 1..unit_count LOOP
                    unit_label := floor_label || ' - Unit ' || unit_idx;
                    INSERT INTO project_geometries (project_id, parent_id, geometry_type, label_en, geometry, properties, level, sort_order)
                    VALUES (
                        proj.id, floor_id, 'unit', unit_label,
                        jsonb_build_object(
                            'type', 'Polygon',
                            'coordinates', jsonb_build_array(jsonb_build_array(
                                jsonb_build_array(base_lng + lng_offset + 0.0003 + (unit_idx * 0.0003), base_lat + lat_offset + 0.0003),
                                jsonb_build_array(base_lng + lng_offset + 0.0003 + (unit_idx * 0.0003) + 0.0004, base_lat + lat_offset + 0.0003),
                                jsonb_build_array(base_lng + lng_offset + 0.0003 + (unit_idx * 0.0003) + 0.0004, base_lat + lat_offset + 0.0035),
                                jsonb_build_array(base_lng + lng_offset + 0.0003 + (unit_idx * 0.0003), base_lat + lat_offset + 0.0035),
                                jsonb_build_array(base_lng + lng_offset + 0.0003 + (unit_idx * 0.0003), base_lat + lat_offset + 0.0003)
                            ))
                        ),
                        jsonb_build_object(
                            'area', 45 + (unit_idx * 10),
                            'unit_type', unit_types[1 + (unit_idx % 5)],
                            'sales_status', sale_statuses[1 + ((bldg_idx + floor_idx + unit_idx) % 5)],
                            'execution_progress', 20 + ((bldg_idx + floor_idx + unit_idx) * 5) % 80
                        ),
                        3, unit_idx
                    );
                END LOOP;
            END LOOP;
        END LOOP;
    END LOOP;
END $$;
