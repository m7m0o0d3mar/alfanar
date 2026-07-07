-- ============================================================================
-- SEED DEMO DATA — مشروع متكامل مترابط مع بيانات في كل الجداول
-- ============================================================================
-- Run via: Get-Content scripts\seed_demo_data.sql -Raw | supabase db query --linked
-- ============================================================================
DO $$
DECLARE
    admin_id       CONSTANT UUID := '2166c66a-5483-4446-b3c3-c9d3687f5229';
    company_id     UUID;
    project_id     UUID;
    block_a_id     UUID;
    block_b_id     UUID;
    bldg_a1_id     UUID;
    bldg_a2_id     UUID;
    bldg_b1_id     UUID;
    bldg_b2_id     UUID;
    floor_a1_1_id  UUID;
    floor_a1_2_id  UUID;
    floor_a1_3_id  UUID;
    floor_a2_1_id  UUID;
    floor_a2_2_id  UUID;
    floor_a2_3_id  UUID;
    floor_b1_1_id  UUID;
    floor_b1_2_id  UUID;
    floor_b1_3_id  UUID;
    floor_b2_1_id  UUID;
    floor_b2_2_id  UUID;
    floor_b2_3_id  UUID;
    geo_project_id UUID;
    geo_bldg_a1_id UUID;
    geo_bldg_a2_id UUID;
    geo_bldg_b1_id UUID;
    geo_bldg_b2_id UUID;
    phase1_id      UUID;
    phase2_id      UUID;
    phase3_id      UUID;
    budget1_id     UUID;
    budget2_id     UUID;
    wi_conc_id     UUID;
    wi_mason_id    UUID;
    wi_plumb_id    UUID;
    wi_elect_id    UUID;
    wi_finish_id   UUID;
    wi_roof_id     UUID;
    unit_ids       UUID[] := '{}';
    u_id           UUID;
    wr_id          UUID;
BEGIN

    -- ==========================================================================
    -- 1. COMPANY
    -- ==========================================================================
    INSERT INTO companies (id, company_type, name_en, name_ar, tax_id, commercial_reg, phone, email, is_active)
    VALUES (gen_random_uuid(), 'developer', 'Alfanar Real Estate Development', 'الفتان للتطوير العقاري',
            '310123456700003', '1234567890', '+966 55 123 4567', 'info@alfanar-realestate.com', true)
    RETURNING id INTO company_id;

    -- ==========================================================================
    -- 2. PROJECT
    -- ==========================================================================
    INSERT INTO projects (id, project_code, name_en, name_ar, description, company_id, project_type, status,
                          start_date, end_date, location, latitude, longitude, total_area, built_up_area,
                          budget_amount, currency, progress_percent, is_active, client_name, is_published)
    VALUES (gen_random_uuid(), 'ALF-RES-2026-001', 'Alfanar Residential Village - Phase 1',
            'قرية الفتان السكنية - المرحلة الأولى',
            'A modern residential village with villas and apartments in the heart of Riyadh',
            company_id, 'residential', 'active', '2026-01-15', '2027-12-30',
            'Riyadh, Al-Malqa District', 24.7741, 46.7095, 50000, 32000,
            150000000, 'SAR', 15.5, true, 'Alfanar Holding', true)
    RETURNING id INTO project_id;

    -- ==========================================================================
    -- 3. USER PROJECT
    -- ==========================================================================
    INSERT INTO user_projects (id, user_id, project_id, project_role)
    VALUES (gen_random_uuid(), admin_id, project_id, 'project_manager');
    INSERT INTO user_projects (id, user_id, project_id, project_role)
    VALUES (gen_random_uuid(), admin_id, project_id, 'owner');

    -- ==========================================================================
    -- 4. BLOCKS
    -- ==========================================================================
    INSERT INTO blocks (id, project_id, block_code, name_en, name_ar, block_type, floor_count, total_units, progress_percent, status, center_lat, center_lng, color)
    VALUES (gen_random_uuid(), project_id, 'A', 'Block A - North', 'الكتلة أ - شمال', 'building', 6, 48, 20.0, 'active', 24.7760, 46.7080, '#4CAF50')
    RETURNING id INTO block_a_id;

    INSERT INTO blocks (id, project_id, block_code, name_en, name_ar, block_type, floor_count, total_units, progress_percent, status, center_lat, center_lng, color)
    VALUES (gen_random_uuid(), project_id, 'B', 'Block B - South', 'الكتلة ب - جنوب', 'building', 6, 48, 10.0, 'active', 24.7720, 46.7100, '#2196F3')
    RETURNING id INTO block_b_id;

    -- ==========================================================================
    -- 5. BUILDINGS
    -- ==========================================================================
    INSERT INTO buildings (id, project_id, block_id, building_code, name_en, name_ar, floors, center_lat, center_lng, area_sqm, height_m, status, color)
    VALUES (gen_random_uuid(), project_id, block_a_id, 'A1', 'Building A1', 'مبنى أ1', 3, 24.7765, 46.7075, 1200, 15, 'active', '#8BC34A')
    RETURNING id INTO bldg_a1_id;

    INSERT INTO buildings (id, project_id, block_id, building_code, name_en, name_ar, floors, center_lat, center_lng, area_sqm, height_m, status, color)
    VALUES (gen_random_uuid(), project_id, block_a_id, 'A2', 'Building A2', 'مبنى أ2', 3, 24.7755, 46.7085, 1200, 15, 'active', '#66BB6A')
    RETURNING id INTO bldg_a2_id;

    INSERT INTO buildings (id, project_id, block_id, building_code, name_en, name_ar, floors, center_lat, center_lng, area_sqm, height_m, status, color)
    VALUES (gen_random_uuid(), project_id, block_b_id, 'B1', 'Building B1', 'مبنى ب1', 3, 24.7725, 46.7095, 1000, 12, 'active', '#42A5F5')
    RETURNING id INTO bldg_b1_id;

    INSERT INTO buildings (id, project_id, block_id, building_code, name_en, name_ar, floors, center_lat, center_lng, area_sqm, height_m, status, color)
    VALUES (gen_random_uuid(), project_id, block_b_id, 'B2', 'Building B2', 'مبنى ب2', 3, 24.7715, 46.7105, 1000, 12, 'active', '#1E88E5')
    RETURNING id INTO bldg_b2_id;

    -- ==========================================================================
    -- 6. FLOORS
    -- ==========================================================================
    -- Building A1 floors
    INSERT INTO floors (id, building_id, block_id, floor_number, name_en, name_ar, area_sqm, height_m, status)
    VALUES (gen_random_uuid(), bldg_a1_id, block_a_id, 1, 'Ground Floor', 'الدور الأرضي', 400, 3.5, 'completed')
    RETURNING id INTO floor_a1_1_id;
    INSERT INTO floors (id, building_id, block_id, floor_number, name_en, name_ar, area_sqm, height_m, status)
    VALUES (gen_random_uuid(), bldg_a1_id, block_a_id, 2, 'First Floor', 'الدور الأول', 400, 3.2, 'active')
    RETURNING id INTO floor_a1_2_id;
    INSERT INTO floors (id, building_id, block_id, floor_number, name_en, name_ar, area_sqm, height_m, status)
    VALUES (gen_random_uuid(), bldg_a1_id, block_a_id, 3, 'Second Floor', 'الدور الثاني', 400, 3.2, 'planning')
    RETURNING id INTO floor_a1_3_id;

    -- Building A2 floors
    INSERT INTO floors (id, building_id, block_id, floor_number, name_en, name_ar, area_sqm, height_m, status)
    VALUES (gen_random_uuid(), bldg_a2_id, block_a_id, 1, 'Ground Floor', 'الدور الأرضي', 400, 3.5, 'active')
    RETURNING id INTO floor_a2_1_id;
    INSERT INTO floors (id, building_id, block_id, floor_number, name_en, name_ar, area_sqm, height_m, status)
    VALUES (gen_random_uuid(), bldg_a2_id, block_a_id, 2, 'First Floor', 'الدور الأول', 400, 3.2, 'planning')
    RETURNING id INTO floor_a2_2_id;
    INSERT INTO floors (id, building_id, block_id, floor_number, name_en, name_ar, area_sqm, height_m, status)
    VALUES (gen_random_uuid(), bldg_a2_id, block_a_id, 3, 'Second Floor', 'الدور الثاني', 400, 3.2, 'planning')
    RETURNING id INTO floor_a2_3_id;

    -- Building B1 floors
    INSERT INTO floors (id, building_id, block_id, floor_number, name_en, name_ar, area_sqm, height_m, status)
    VALUES (gen_random_uuid(), bldg_b1_id, block_b_id, 1, 'Ground Floor', 'الدور الأرضي', 333, 3.5, 'active')
    RETURNING id INTO floor_b1_1_id;
    INSERT INTO floors (id, building_id, block_id, floor_number, name_en, name_ar, area_sqm, height_m, status)
    VALUES (gen_random_uuid(), bldg_b1_id, block_b_id, 2, 'First Floor', 'الدور الأول', 333, 3.2, 'planning')
    RETURNING id INTO floor_b1_2_id;
    INSERT INTO floors (id, building_id, block_id, floor_number, name_en, name_ar, area_sqm, height_m, status)
    VALUES (gen_random_uuid(), bldg_b1_id, block_b_id, 3, 'Second Floor', 'الدور الثاني', 333, 3.2, 'planning')
    RETURNING id INTO floor_b1_3_id;

    -- Building B2 floors
    INSERT INTO floors (id, building_id, block_id, floor_number, name_en, name_ar, area_sqm, height_m, status)
    VALUES (gen_random_uuid(), bldg_b2_id, block_b_id, 1, 'Ground Floor', 'الدور الأرضي', 333, 3.5, 'planning')
    RETURNING id INTO floor_b2_1_id;
    INSERT INTO floors (id, building_id, block_id, floor_number, name_en, name_ar, area_sqm, height_m, status)
    VALUES (gen_random_uuid(), bldg_b2_id, block_b_id, 2, 'First Floor', 'الدور الأول', 333, 3.2, 'planning')
    RETURNING id INTO floor_b2_2_id;
    INSERT INTO floors (id, building_id, block_id, floor_number, name_en, name_ar, area_sqm, height_m, status)
    VALUES (gen_random_uuid(), bldg_b2_id, block_b_id, 3, 'Second Floor', 'الدور الثاني', 333, 3.2, 'planning')
    RETURNING id INTO floor_b2_3_id;

    -- ==========================================================================
    -- 7. PROJECT GEOMETRIES (for map)
    -- ==========================================================================

    -- Project boundary (site)
    INSERT INTO project_geometries (id, project_id, parent_id, geometry_type, label_en, label_ar, geometry, properties, level, status)
    VALUES (gen_random_uuid(), project_id, NULL, 'site', 'Alfanar Residential Village', 'قرية الفتان السكنية',
            '{"type":"Polygon","coordinates":[[[46.705,24.777],[46.712,24.777],[46.714,24.770],[46.707,24.769],[46.705,24.777]]]}',
            '{"fillColor":"#4CAF50","fillOpacity":0.1,"strokeColor":"#4CAF50","strokeWeight":2}', 0, 'active')
    RETURNING id INTO geo_project_id;

    -- Building A1
    INSERT INTO project_geometries (id, project_id, parent_id, geometry_type, label_en, label_ar, geometry, properties, level, status)
    VALUES (gen_random_uuid(), project_id, geo_project_id, 'building', 'Building A1', 'مبنى أ1',
            '{"type":"Polygon","coordinates":[[[46.7068,24.7768],[46.7082,24.7768],[46.7082,24.7762],[46.7068,24.7762],[46.7068,24.7768]]]}',
            jsonb_build_object('building_id', bldg_a1_id, 'fillColor', '#8BC34A', 'fillOpacity', 0.4, 'strokeColor', '#333', 'strokeWeight', 1), 1, 'active')
    RETURNING id INTO geo_bldg_a1_id;

    -- Building A2
    INSERT INTO project_geometries (id, project_id, parent_id, geometry_type, label_en, label_ar, geometry, properties, level, status)
    VALUES (gen_random_uuid(), project_id, geo_project_id, 'building', 'Building A2', 'مبنى أ2',
            '{"type":"Polygon","coordinates":[[[46.7065,24.7760],[46.7079,24.7760],[46.7079,24.7754],[46.7065,24.7754],[46.7065,24.7760]]]}',
            jsonb_build_object('building_id', bldg_a2_id, 'fillColor', '#66BB6A', 'fillOpacity', 0.4, 'strokeColor', '#333', 'strokeWeight', 1), 1, 'active')
    RETURNING id INTO geo_bldg_a2_id;

    -- Building B1
    INSERT INTO project_geometries (id, project_id, parent_id, geometry_type, label_en, label_ar, geometry, properties, level, status)
    VALUES (gen_random_uuid(), project_id, geo_project_id, 'building', 'Building B1', 'مبنى ب1',
            '{"type":"Polygon","coordinates":[[[46.7090,24.7730],[46.7104,24.7730],[46.7104,24.7724],[46.7090,24.7724],[46.7090,24.7730]]]}',
            jsonb_build_object('building_id', bldg_b1_id, 'fillColor', '#42A5F5', 'fillOpacity', 0.4, 'strokeColor', '#333', 'strokeWeight', 1), 1, 'active')
    RETURNING id INTO geo_bldg_b1_id;

    -- Building B2
    INSERT INTO project_geometries (id, project_id, parent_id, geometry_type, label_en, label_ar, geometry, properties, level, status)
    VALUES (gen_random_uuid(), project_id, geo_project_id, 'building', 'Building B2', 'مبنى ب2',
            '{"type":"Polygon","coordinates":[[[46.7087,24.7722],[46.7101,24.7722],[46.7101,24.7716],[46.7087,24.7716],[46.7087,24.7722]]]}',
            jsonb_build_object('building_id', bldg_b2_id, 'fillColor', '#1E88E5', 'fillOpacity', 0.4, 'strokeColor', '#333', 'strokeWeight', 1), 1, 'active')
    RETURNING id INTO geo_bldg_b2_id;

    -- ==========================================================================
    -- 8. UNITS — Building A1
    -- ==========================================================================
    -- Floor 1 (A1): 4 units
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_a_id, floor_a1_1_id, 'A1-101', 'apartment', 1, 95, 2, 2, 'available', 450000, true, 24.7766, 46.7075)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_a_id, floor_a1_1_id, 'A1-102', 'apartment', 1, 120, 3, 2, 'available', 520000, true, 24.7765, 46.7076)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_a_id, floor_a1_1_id, 'A1-103', 'studio', 1, 40, 0, 1, 'sold', 180000, true, 24.7764, 46.7077)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_a_id, floor_a1_1_id, 'A1-104', 'apartment', 1, 150, 3, 3, 'available', 650000, true, 24.7763, 46.7078)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;

    -- Floor 2 (A1): 4 units
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_a_id, floor_a1_2_id, 'A1-201', 'apartment', 2, 100, 2, 2, 'available', 480000, true, 24.7766, 46.7075)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_a_id, floor_a1_2_id, 'A1-202', 'apartment', 2, 130, 3, 2, 'reserved', 550000, true, 24.7765, 46.7076)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_a_id, floor_a1_2_id, 'A1-203', 'apartment', 2, 85, 2, 1, 'available', 380000, true, 24.7764, 46.7077)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_a_id, floor_a1_2_id, 'A1-204', 'penthouse', 2, 200, 4, 4, 'available', 950000, true, 24.7763, 46.7078)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;

    -- Floor 3 (A1): 4 units
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_a_id, floor_a1_3_id, 'A1-301', 'apartment', 3, 100, 2, 2, 'available', 480000, true, 24.7766, 46.7075)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_a_id, floor_a1_3_id, 'A1-302', 'apartment', 3, 110, 2, 2, 'available', 500000, true, 24.7765, 46.7076)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_a_id, floor_a1_3_id, 'A1-303', 'duplex', 3, 180, 4, 3, 'available', 780000, true, 24.7764, 46.7077)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_a_id, floor_a1_3_id, 'A1-304', 'studio', 3, 35, 0, 1, 'available', 160000, true, 24.7763, 46.7078)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;

    -- ==========================================================================
    -- 9. UNITS — Building A2 (2 per floor)
    -- ==========================================================================
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_a_id, floor_a2_1_id, 'A2-101', 'villa', 1, 250, 4, 4, 'available', 1200000, true, 24.7757, 46.7079)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_a_id, floor_a2_1_id, 'A2-102', 'villa', 1, 280, 5, 4, 'available', 1400000, true, 24.7753, 46.7080)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;

    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_a_id, floor_a2_2_id, 'A2-201', 'villa', 2, 260, 4, 4, 'reserved', 1250000, true, 24.7757, 46.7079)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_a_id, floor_a2_2_id, 'A2-202', 'villa', 2, 300, 5, 5, 'available', 1550000, true, 24.7753, 46.7080)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;

    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_a_id, floor_a2_3_id, 'A2-301', 'villa', 3, 270, 4, 4, 'available', 1300000, true, 24.7757, 46.7079)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_a_id, floor_a2_3_id, 'A2-302', 'villa', 3, 320, 5, 5, 'available', 1600000, true, 24.7753, 46.7080)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;

    -- ==========================================================================
    -- 10. UNITS — Building B1 (3 per floor)
    -- ==========================================================================
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_b_id, floor_b1_1_id, 'B1-101', 'office', 1, 60, 0, 1, 'available', 250000, true, 24.7727, 46.7096)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_b_id, floor_b1_1_id, 'B1-102', 'shop', 1, 80, 0, 1, 'available', 350000, true, 24.7724, 46.7097)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_b_id, floor_b1_1_id, 'B1-103', 'office', 1, 45, 0, 1, 'available', 200000, true, 24.7722, 46.7098)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;

    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_b_id, floor_b1_2_id, 'B1-201', 'office', 2, 70, 0, 1, 'available', 280000, true, 24.7727, 46.7096)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_b_id, floor_b1_2_id, 'B1-202', 'warehouse', 2, 150, 0, 1, 'available', 400000, true, 24.7724, 46.7097)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_b_id, floor_b1_2_id, 'B1-203', 'office', 2, 55, 0, 1, 'available', 230000, true, 24.7722, 46.7098)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;

    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_b_id, floor_b1_3_id, 'B1-301', 'office', 3, 65, 0, 1, 'available', 260000, true, 24.7727, 46.7096)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_b_id, floor_b1_3_id, 'B1-302', 'office', 3, 90, 1, 1, 'available', 370000, true, 24.7724, 46.7097)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_b_id, floor_b1_3_id, 'B1-303', 'warehouse', 3, 200, 0, 1, 'available', 500000, true, 24.7722, 46.7098)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;

    -- ==========================================================================
    -- 11. UNITS — Building B2 (2 per floor)
    -- ==========================================================================
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_b_id, floor_b2_1_id, 'B2-101', 'apartment', 1, 90, 2, 2, 'available', 350000, true, 24.7717, 46.7102)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_b_id, floor_b2_1_id, 'B2-102', 'apartment', 1, 110, 3, 2, 'available', 420000, true, 24.7713, 46.7103)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;

    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_b_id, floor_b2_2_id, 'B2-201', 'apartment', 2, 95, 2, 2, 'available', 380000, true, 24.7717, 46.7102)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_b_id, floor_b2_2_id, 'B2-202', 'apartment', 2, 130, 3, 3, 'available', 480000, true, 24.7713, 46.7103)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;

    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_b_id, floor_b2_3_id, 'B2-301', 'apartment', 3, 100, 2, 2, 'available', 390000, true, 24.7717, 46.7102)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;
    INSERT INTO units (id, project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, bathrooms, status, price, is_active, lat, lng)
    VALUES (gen_random_uuid(), project_id, block_b_id, floor_b2_3_id, 'B2-302', 'apartment', 3, 140, 3, 3, 'available', 510000, true, 24.7713, 46.7103)
    RETURNING id INTO u_id; unit_ids := unit_ids || u_id;

    -- ==========================================================================
    -- 12. MAP ANNOTATIONS
    -- ==========================================================================
    INSERT INTO map_annotations (id, project_id, user_id, title, description, geometry, annotation_type, color)
    VALUES (gen_random_uuid(), project_id, admin_id, 'Main Entrance', 'المدخل الرئيسي للمشروع',
            '{"type":"Point","coordinates":[46.7055,24.7765]}', 'marker', '#FF5722');

    INSERT INTO map_annotations (id, project_id, user_id, title, description, geometry, annotation_type, color)
    VALUES (gen_random_uuid(), project_id, admin_id, 'Parking Area', 'مواقف السيارات',
            '{"type":"Polygon","coordinates":[[[46.711,24.775],[46.713,24.775],[46.713,24.774],[46.711,24.774],[46.711,24.775]]]}', 'polygon', '#9C27B0');

    -- ==========================================================================
    -- 13. PROJECT PHASES
    -- ==========================================================================
    INSERT INTO project_phases (id, project_id, phase_code, name_en, name_ar, description, start_date, end_date, budget, progress_percent, status, "order", planned_value, earned_value, actual_cost)
    VALUES (gen_random_uuid(), project_id, 'FOUNDATION', 'Foundation & Site Prep', 'الأساسات وتجهيز الموقع', 'Excavation, foundations, and site preparation work', '2026-01-15', '2026-04-30', 20000000, 100, 'completed', 1, 20000000, 20000000, 18500000)
    RETURNING id INTO phase1_id;

    INSERT INTO project_phases (id, project_id, phase_code, name_en, name_ar, description, start_date, end_date, budget, progress_percent, status, "order", planned_value, earned_value, actual_cost)
    VALUES (gen_random_uuid(), project_id, 'STRUCTURE', 'Structural Works', 'الأعمال الهيكلية', 'Concrete structure, columns, slabs, and roofing', '2026-05-01', '2026-12-31', 50000000, 25, 'active', 2, 50000000, 12500000, 11000000)
    RETURNING id INTO phase2_id;

    INSERT INTO project_phases (id, project_id, phase_code, name_en, name_ar, description, start_date, end_date, budget, progress_percent, status, "order", planned_value, earned_value, actual_cost)
    VALUES (gen_random_uuid(), project_id, 'FINISHING', 'Finishing & MEP', 'التشطيبات والخدمات', 'Plumbing, electrical, HVAC, flooring, painting, and final finishes', '2027-01-01', '2027-09-30', 50000000, 0, 'pending', 3, 50000000, 0, 0)
    RETURNING id INTO phase3_id;

    INSERT INTO project_phases (id, project_id, phase_code, name_en, name_ar, description, start_date, end_date, budget, progress_percent, status, "order", planned_value, earned_value, actual_cost)
    VALUES (gen_random_uuid(), project_id, 'LANDSCAPE', 'Landscaping & Handover', 'تنسيق الموقع والتسليم', 'Landscaping, roads, parking, and final handover', '2027-10-01', '2027-12-30', 30000000, 0, 'pending', 4, 30000000, 0, 0);

    -- ==========================================================================
    -- 14. BUDGET
    -- ==========================================================================
    INSERT INTO budget (id, budget_code, description, total_budget, used_amount, project_id, category, budget_type, currency, status)
    VALUES (gen_random_uuid(), 'BUD-CONC-001', 'Concrete and steel reinforcement for all buildings', 35000000, 9000000, project_id, 'Construction', 'operating', 'SAR', 'active')
    RETURNING id INTO budget1_id;

    INSERT INTO budget (id, budget_code, description, total_budget, used_amount, project_id, category, budget_type, currency, status)
    VALUES (gen_random_uuid(), 'BUD-MEP-001', 'Mechanical, electrical, and plumbing works', 25000000, 3000000, project_id, 'Construction', 'operating', 'SAR', 'active')
    RETURNING id INTO budget2_id;

    INSERT INTO budget (id, budget_code, description, total_budget, used_amount, project_id, category, budget_type, currency, status)
    VALUES (gen_random_uuid(), 'BUD-LAB-001', 'Labor costs for all construction phases', 15000000, 4500000, project_id, 'Labor', 'operating', 'SAR', 'active');

    INSERT INTO budget (id, budget_code, description, total_budget, used_amount, project_id, category, budget_type, currency, status)
    VALUES (gen_random_uuid(), 'BUD-EQP-001', 'Heavy equipment and machinery rental', 8000000, 2000000, project_id, 'Equipment', 'operating', 'SAR', 'active');

    INSERT INTO budget (id, budget_code, description, total_budget, used_amount, project_id, category, budget_type, currency, status)
    VALUES (gen_random_uuid(), 'BUD-ADM-001', 'Office, permits, insurance, and admin costs', 5000000, 1500000, project_id, 'Administrative', 'operating', 'SAR', 'active');

    -- ==========================================================================
    -- 15. WORK ITEMS
    -- ==========================================================================
    INSERT INTO work_items (id, project_id, item_code, name_en, name_ar, category, unit_of_measure, is_active)
    VALUES (gen_random_uuid(), project_id, 'CONC-FOUND', 'Concrete Foundation', 'صب الخرسانة - أساسات', 'Structural', 'm³', true)
    RETURNING id INTO wi_conc_id;

    INSERT INTO work_items (id, project_id, item_code, name_en, name_ar, category, unit_of_measure, is_active)
    VALUES (gen_random_uuid(), project_id, 'MASON-BLOCK', 'Masonry Block Work', 'بناء الطوب', 'Masonry', 'm²', true)
    RETURNING id INTO wi_mason_id;

    INSERT INTO work_items (id, project_id, item_code, name_en, name_ar, category, unit_of_measure, is_active)
    VALUES (gen_random_uuid(), project_id, 'PLUMB-WATER', 'Plumbing - Water Supply', 'سباكة - شبكة مياه', 'MEP', 'point', true)
    RETURNING id INTO wi_plumb_id;

    INSERT INTO work_items (id, project_id, item_code, name_en, name_ar, category, unit_of_measure, is_active)
    VALUES (gen_random_uuid(), project_id, 'ELECT-WIRE', 'Electrical Wiring', 'تمديدات كهربائية', 'MEP', 'point', true)
    RETURNING id INTO wi_elect_id;

    INSERT INTO work_items (id, project_id, item_code, name_en, name_ar, category, unit_of_measure, is_active)
    VALUES (gen_random_uuid(), project_id, 'FINISH-PLASTER', 'Plastering & Finishing', 'لياسة وتشطيب', 'Finishing', 'm²', true)
    RETURNING id INTO wi_finish_id;

    INSERT INTO work_items (id, project_id, item_code, name_en, name_ar, category, unit_of_measure, is_active)
    VALUES (gen_random_uuid(), project_id, 'ROOF-WATER', 'Roof Waterproofing', 'عازل مائي للأسطح', 'Waterproofing', 'm²', true)
    RETURNING id INTO wi_roof_id;

    -- ==========================================================================
    -- 16. UNIT PROGRESS + ITEM PROGRESS (for a few units)
    -- ==========================================================================
    -- Unit progress for A1-101 (mostly done)
    INSERT INTO unit_progress (id, unit_id, milestone_code, milestone_name_en, milestone_name_ar, weight_percent, status, achieved_date, progress_pct)
    VALUES (gen_random_uuid(), unit_ids[1], 'foundation', 'Foundation Complete', 'اكتمال الأساسات', 20, 'completed', '2026-03-15', 100);
    INSERT INTO unit_progress (id, unit_id, milestone_code, milestone_name_en, milestone_name_ar, weight_percent, status, achieved_date, progress_pct)
    VALUES (gen_random_uuid(), unit_ids[1], 'structure', 'Structure Complete', 'اكتمال الهيكل', 30, 'completed', '2026-06-20', 100);
    INSERT INTO unit_progress (id, unit_id, milestone_code, milestone_name_en, milestone_name_ar, weight_percent, status, achieved_date, progress_pct)
    VALUES (gen_random_uuid(), unit_ids[1], 'rough_mep', 'Rough MEP Complete', 'اكتمال الخدمات الأولية', 15, 'completed', '2026-08-10', 100);
    INSERT INTO unit_progress (id, unit_id, milestone_code, milestone_name_en, milestone_name_ar, weight_percent, status, achieved_date, progress_pct)
    VALUES (gen_random_uuid(), unit_ids[1], 'finishing', 'Finishing Works', 'أعمال التشطيب', 20, 'in_progress', NULL, 30);

    -- Unit progress for A1-102 (partially done)
    INSERT INTO unit_progress (id, unit_id, milestone_code, milestone_name_en, milestone_name_ar, weight_percent, status, achieved_date, progress_pct)
    VALUES (gen_random_uuid(), unit_ids[2], 'foundation', 'Foundation Complete', 'اكتمال الأساسات', 20, 'completed', '2026-03-18', 100);
    INSERT INTO unit_progress (id, unit_id, milestone_code, milestone_name_en, milestone_name_ar, weight_percent, status, achieved_date, progress_pct)
    VALUES (gen_random_uuid(), unit_ids[2], 'structure', 'Structure Complete', 'اكتمال الهيكل', 30, 'completed', '2026-07-05', 100);
    INSERT INTO unit_progress (id, unit_id, milestone_code, milestone_name_en, milestone_name_ar, weight_percent, status, achieved_date, progress_pct)
    VALUES (gen_random_uuid(), unit_ids[2], 'rough_mep', 'Rough MEP Complete', 'اكتمال الخدمات الأولية', 15, 'pending', NULL, 0);

    -- ==========================================================================
    -- 17. DAILY REPORTS
    -- ==========================================================================
    INSERT INTO daily_reports (id, project_id, report_date, title, weather, temperature, labor_count, equipment_count, summary, created_by)
    VALUES (gen_random_uuid(), project_id, '2026-07-01', 'Site Preparation - Day 1', 'Sunny', '38°C', 25, 4,
            'Started site preparation for Block A. Excavation completed for Building A1 foundation.',
            admin_id);

    INSERT INTO daily_reports (id, project_id, report_date, title, weather, temperature, labor_count, equipment_count, summary, created_by)
    VALUES (gen_random_uuid(), project_id, '2026-07-02', 'Foundation Work - Block A', 'Hot', '40°C', 30, 5,
            'Continued foundation work for Building A1. Concrete pouring for columns started.',
            admin_id);

    INSERT INTO daily_reports (id, project_id, report_date, title, weather, temperature, labor_count, equipment_count, summary, created_by)
    VALUES (gen_random_uuid(), project_id, '2026-07-05', 'Block B Excavation', 'Sunny', '37°C', 20, 3,
            'Started excavation for Block B. Site cleared and survey completed.',
            admin_id);

    INSERT INTO daily_reports (id, project_id, report_date, title, weather, temperature, labor_count, equipment_count, summary, created_by)
    VALUES (gen_random_uuid(), project_id, '2026-07-08', 'Steel Reinforcement - A1', 'Clear', '39°C', 35, 2,
            'Steel reinforcement installation for Building A1 first floor slab. QC inspection passed.',
            admin_id);

    INSERT INTO daily_reports (id, project_id, report_date, title, weather, temperature, labor_count, equipment_count, summary, created_by)
    VALUES (gen_random_uuid(), project_id, '2026-07-12', 'Concrete Pouring - A1 Slab', 'Sunny', '41°C', 40, 6,
            'Concrete pouring for Building A1 first floor slab completed. Total 120 m³ used.',
            admin_id);

    -- ==========================================================================
    -- 18. WORK REQUESTS (WIR)
    -- ==========================================================================
    INSERT INTO work_requests (id, project_id, unit_id, wir_no, title_en, title_ar, description, request_date, requested_by, status, location, discipline)
    VALUES (gen_random_uuid(), project_id, NULL, 'WIR-2026-001', 'Foundation Excavation - Block A', 'حفر الأساسات - الكتلة أ',
            'Excavation for building foundations in Block A - depth 3 meters', '2026-01-20', admin_id, 'approved', 'Block A', 'Civil')
    RETURNING id INTO wr_id;

    INSERT INTO work_requests (id, project_id, unit_id, wir_no, title_en, title_ar, description, request_date, requested_by, status, location, discipline,
                               inspection_date, qc_approved, consultant_approved, pm_approved)
    VALUES (gen_random_uuid(), project_id, NULL, 'WIR-2026-002', 'Concrete Pouring - Building A1 Foundation', 'صب الخرسانة - أساسات مبنى أ1',
            'Concrete pouring for Building A1 foundation - grade C35', '2026-02-10', admin_id, 'inspected',
            'Building A1 - Foundation', 'Structural', '2026-02-12', true, true, true);

    INSERT INTO work_requests (id, project_id, unit_id, wir_no, title_en, title_ar, description, request_date, requested_by, status, location, discipline,
                               inspection_date, qc_approved, pm_approved)
    VALUES (gen_random_uuid(), project_id, unit_ids[1], 'WIR-2026-003', 'Steel Reinforcement - Unit A1-101', 'تسليح حديد - وحدة أ1-101',
            'Steel reinforcement inspection for unit A1-101 columns and beams', '2026-03-05', admin_id, 'inspected',
            'Building A1 - Unit 101', 'Structural', '2026-03-06', true, true);

    INSERT INTO work_requests (id, project_id, unit_id, wir_no, title_en, title_ar, description, request_date, requested_by, status, location, discipline,
                               inspection_date, qc_approved, consultant_approved, pm_approved)
    VALUES (gen_random_uuid(), project_id, unit_ids[1], 'WIR-2026-004', 'Plumbing Inspection - Unit A1-101', 'فحص السباكة - وحدة أ1-101',
            'Water supply and drainage inspection for unit A1-101', '2026-08-15', admin_id, 'inspected',
            'Building A1 - Unit 101', 'MEP', '2026-08-16', true, true, true);

    INSERT INTO work_requests (id, project_id, unit_id, wir_no, title_en, title_ar, description, request_date, requested_by, status, location, discipline)
    VALUES (gen_random_uuid(), project_id, unit_ids[3], 'WIR-2026-005', 'Electrical Rough-In - Unit A1-103', 'التمديدات الكهربائية - وحدة أ1-103',
            'Electrical conduit and wiring rough-in for unit A1-103', '2026-09-01', admin_id, 'draft',
            'Building A1 - Unit 103', 'MEP');

    -- ==========================================================================
    -- 19. PROPERTY MEDIA (sample)
    -- ==========================================================================
    INSERT INTO property_media (id, unit_id, project_id, url, media_type, caption, sort_order, is_featured, is_published)
    VALUES (gen_random_uuid(), unit_ids[1], project_id, 'https://placehold.co/800x600/4CAF50/white?text=A1-101+Living+Room', 'image', 'Living Room - Unit A1-101', 1, true, true);

    INSERT INTO property_media (id, unit_id, project_id, url, media_type, caption, sort_order, is_featured, is_published)
    VALUES (gen_random_uuid(), unit_ids[1], project_id, 'https://placehold.co/800x600/2196F3/white?text=A1-101+Bedroom', 'image', 'Master Bedroom - Unit A1-101', 2, false, true);

    INSERT INTO property_media (id, unit_id, project_id, url, media_type, caption, sort_order, is_featured, is_published)
    VALUES (gen_random_uuid(), unit_ids[1], project_id, 'https://placehold.co/800x600/FF9800/white?text=A1-101+Kitchen', 'image', 'Kitchen - Unit A1-101', 3, false, true);

    RAISE NOTICE 'Seed completed: 1 project, 2 blocks, 4 buildings, 12 floors, % units, geometries, phases, budgets, work items, progress, reports, WIRs, media', array_length(unit_ids, 1);
END;
$$;
