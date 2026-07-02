-- 107: Comprehensive Map Test Data
-- Realistic Saudi Arabia locations with full hierarchy

-- ============================================
-- Helper: Create GeoJSON rectangle polygon
-- ============================================
do $$
declare
  proj1_id uuid; proj2_id uuid; proj3_id uuid;
  blk1_id uuid; blk2_id uuid; blk3_id uuid; blk4_id uuid; blk5_id uuid;
  bld1_id uuid; bld2_id uuid; bld3_id uuid; bld4_id uuid; bld5_id uuid; bld6_id uuid;
  fl_prefix text;
  rect jsonb;
begin
  -- ==========================================
  -- 1. Al Fanar Residences - Riyadh (North)
  -- ==========================================
  insert into projects (project_code, name_en, name_ar, project_type, status, latitude, longitude, center_lat, center_lng, progress_percent, is_active, is_published)
  values ('AFR-001', 'Al Fanar Residences', 'الفنار السكني', 'residential', 'active', 24.8600, 46.7200, 24.8600, 46.7200, 45, true, true)
  returning id into proj1_id;

  -- Block A (6 buildings)
  insert into blocks (project_id, block_code, name_en, name_ar, block_type, floor_count, total_units, status, center_lat, center_lng, area_sqm, color, progress_percent)
  values (proj1_id, 'BLK-A', 'Block A - East Compound', 'الكتلة أ - المجمع الشرقي', 'wing', 5, 48, 'active', 24.8620, 46.7250, 12000, '#3b82f6', 60);
  insert into blocks (project_id, block_code, name_en, name_ar, block_type, floor_count, total_units, status, center_lat, center_lng, area_sqm, color, progress_percent)
  values (proj1_id, 'BLK-B', 'Block B - West Compound', 'الكتلة ب - المجمع الغربي', 'wing', 4, 36, 'in_progress', 24.8580, 46.7150, 10000, '#10b981', 30);
  insert into blocks (project_id, block_code, name_en, name_ar, block_type, floor_count, total_units, status, center_lat, center_lng, area_sqm, color, progress_percent)
  values (proj1_id, 'BLK-C', 'Block C - North Tower', 'الكتلة ج - البرج الشمالي', 'tower', 12, 96, 'planning', 24.8650, 46.7200, 8000, '#8b5cf6', 10);
  insert into blocks (project_id, block_code, name_en, name_ar, block_type, floor_count, total_units, status, center_lat, center_lng, area_sqm, color, progress_percent)
  values (proj1_id, 'BLK-D', 'Block D - Villa Garden', 'الكتلة د - حديقة الفلل', 'villa', 2, 16, 'active', 24.8550, 46.7220, 15000, '#f59e0b', 75);

  -- Buildings in Block A
  for i in 1..3 loop
    insert into buildings (project_id, block_id, building_code, name_en, name_ar, floors, status, center_lat, center_lng, height_m, color)
    values (proj1_id, (select id from blocks where project_id=proj1_id and block_code='BLK-A' limit 1),
            'A-0'||i, 'Building A'||i, 'مبنى أ'||i, 5, 'active',
            24.8620 + (i-2)*0.002, 46.7260 + (i-2)*0.002, 15, '#60a5fa');
  end loop;

  -- Buildings in Block B
  for i in 1..2 loop
    insert into buildings (project_id, block_id, building_code, name_en, name_ar, floors, status, center_lat, center_lng, height_m, color)
    values (proj1_id, (select id from blocks where project_id=proj1_id and block_code='BLK-B' limit 1),
            'B-0'||i, 'Building B'||i, 'مبنى ب'||i, 4, 'in_progress',
            24.8580 + (i-1)*0.003, 46.7160 + (i-1)*0.002, 12, '#34d399');
  end loop;

  -- Building in Block C (tower)
  insert into buildings (project_id, block_id, building_code, name_en, name_ar, floors, status, center_lat, center_lng, height_m, color)
  values (proj1_id, (select id from blocks where project_id=proj1_id and block_code='BLK-C' limit 1),
          'C-001', 'North Tower', 'البرج الشمالي', 12, 'planning',
          24.8650, 46.7200, 42, '#a78bfa');

  -- ==========================================
  -- 2. Jeddah Waterfront Project
  -- ==========================================
  insert into projects (project_code, name_en, name_ar, project_type, status, latitude, longitude, center_lat, center_lng, progress_percent, is_active, is_published)
  values ('JWP-001', 'Jeddah Waterfront', 'واجهة جدة البحرية', 'mixed_use', 'active', 21.5433, 39.1728, 21.5433, 39.1728, 70, true, true)
  returning id into proj2_id;

  insert into blocks (project_id, block_code, name_en, name_ar, block_type, floor_count, total_units, status, center_lat, center_lng, area_sqm, color)
  values (proj2_id, 'J-BLK1', 'Marina Village', 'قرية المارينا', 'villa', 3, 24, 'active', 21.5450, 39.1750, 20000, '#06b6d4');
  insert into blocks (project_id, block_code, name_en, name_ar, block_type, floor_count, total_units, status, center_lat, center_lng, area_sqm, color)
  values (proj2_id, 'J-BLK2', 'Beachfront Tower', 'برج الشاطئ', 'tower', 8, 64, 'in_progress', 21.5410, 39.1700, 6000, '#f97316');

  -- ==========================================
  -- 3. Dammam Industrial City
  -- ==========================================
  insert into projects (project_code, name_en, name_ar, project_type, status, latitude, longitude, center_lat, center_lng, progress_percent, is_active, is_published)
  values ('DIC-001', 'Dammam Industrial City', 'مدينة الدمام الصناعية', 'industrial', 'active', 26.4200, 50.1200, 26.4200, 50.1200, 25, true, false)
  returning id into proj3_id;

  insert into blocks (project_id, block_code, name_en, name_ar, block_type, floor_count, total_units, status, center_lat, center_lng, area_sqm, color)
  values (proj3_id, 'D-BLK1', 'Factory Zone A', 'منطقة المصنع أ', 'phase', 2, 10, 'active', 26.4220, 50.1230, 50000, '#64748b');
  insert into blocks (project_id, block_code, name_en, name_ar, block_type, floor_count, total_units, status, center_lat, center_lng, area_sqm, color)
  values (proj3_id, 'D-BLK2', 'Logistics Hub', 'مركز اللوجستيات', 'phase', 3, 6, 'planning', 26.4180, 50.1170, 30000, '#94a3b8');

  -- ==========================================
  -- Seed units for Al Fanar Block A Building 1
  -- ==========================================
  select id into bld1_id from buildings where building_code = 'A-01' limit 1;
  
  -- Create 5 floors, 4 units each
  for fl in 1..5 loop
    declare
      fid uuid;
    begin
      insert into floors (building_id, floor_number, name_en, name_ar, area_sqm, height_m, status)
      values (bld1_id, fl, 'Floor '||fl, 'الدور '||fl, 800, 3.0, 'active')
      returning id into fid;

      for u in 1..4 loop
        insert into units (project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, status, price, is_active, is_published)
        values (proj1_id, 
                (select id from blocks where project_id=proj1_id and block_code='BLK-A' limit 1),
                fid,
                'A-01-'||fl||'0'||u,
                case when u <= 2 then 'apartment' else 'studio' end,
                fl, 120 - u*10, case when u <= 2 then 2 else 1 end,
                case when fl <= 2 then 'available' when fl <= 4 then 'reserved' else 'sold' end,
                450000 + (fl*50000) + (u*25000),
                true, true);
      end loop;
    end;
  end loop;

  -- ==========================================
  -- Seed units for Jeddah Block 1
  -- ==========================================
  select id into blk1_id from blocks where block_code = 'J-BLK1' limit 1;
  select id into bld2_id from buildings where building_code = 'J-BLK1-BLD-1' limit 1;
  
  -- If no building exists, create one
  if bld2_id is null then
    insert into buildings (project_id, block_id, building_code, name_en, name_ar, floors, status, center_lat, center_lng, height_m, color)
    values (proj2_id, blk1_id, 'J-BLK1-BLD-1', 'Marina Building 1', 'مبنى المارينا 1', 3, 'active', 21.5455, 39.1755, 12, '#22d3ee')
    returning id into bld2_id;
  end if;

  for fl in 1..3 loop
    declare
      fid uuid;
    begin
      insert into floors (building_id, floor_number, name_en, area_sqm, height_m, status)
      values (bld2_id, fl, 'Marina Floor '||fl, 600, 3.0, 'active')
      returning id into fid;

      for u in 1..4 loop
        insert into units (project_id, block_id, floor_id, unit_code, unit_type, floor_number, area_sqm, bedrooms, status, price, is_active, is_published)
        values (proj2_id, blk1_id, fid,
                'J-B1-'||fl||'0'||u, 'apartment', fl, 150, 3,
                case when fl=1 then 'available' when fl=2 then 'reserved' else 'sold' end,
                850000 + (fl*75000) + (u*30000), true, true);
      end loop;
    end;
  end loop;

  -- ==========================================
  -- Create GeoJSON polygons for Al Fanar blocks
  -- ==========================================
  -- Block A: rectangle around center (24.8620, 46.7250)
  update blocks set geometry = jsonb_build_object(
    'type', 'Polygon',
    'coordinates', jsonb_build_array(jsonb_build_array(
      jsonb_build_array(46.7220, 24.8595),
      jsonb_build_array(46.7280, 24.8595),
      jsonb_build_array(46.7280, 24.8645),
      jsonb_build_array(46.7220, 24.8645),
      jsonb_build_array(46.7220, 24.8595)
    ))
  ) where block_code = 'BLK-A' and project_id = proj1_id;

  -- Block B: rectangle
  update blocks set geometry = jsonb_build_object(
    'type', 'Polygon',
    'coordinates', jsonb_build_array(jsonb_build_array(
      jsonb_build_array(46.7120, 24.8555),
      jsonb_build_array(46.7180, 24.8555),
      jsonb_build_array(46.7180, 24.8605),
      jsonb_build_array(46.7120, 24.8605),
      jsonb_build_array(46.7120, 24.8555)
    ))
  ) where block_code = 'BLK-B' and project_id = proj1_id;

  -- Block C: rectangle (tower footprint)
  update blocks set geometry = jsonb_build_object(
    'type', 'Polygon',
    'coordinates', jsonb_build_array(jsonb_build_array(
      jsonb_build_array(46.7180, 24.8635),
      jsonb_build_array(46.7220, 24.8635),
      jsonb_build_array(46.7220, 24.8665),
      jsonb_build_array(46.7180, 24.8665),
      jsonb_build_array(46.7180, 24.8635)
    ))
  ) where block_code = 'BLK-C' and project_id = proj1_id;

  -- ==========================================
  -- Create project_geometries for full hierarchy
  -- ==========================================
  -- Site boundary for Al Fanar
  insert into project_geometries (project_id, geometry_type, label_en, label_ar, geometry, level, sort_order, status) values
  (proj1_id, 'site', 'Al Fanar Site', 'موقع الفنار', 
   jsonb_build_object('type','Polygon','coordinates',jsonb_build_array(jsonb_build_array(
     jsonb_build_array(46.710,24.853), jsonb_build_array(46.732,24.853),
     jsonb_build_array(46.732,24.870), jsonb_build_array(46.710,24.870),
     jsonb_build_array(46.710,24.853)))),
   0, 1, 'active');

  -- Buildings as geometries
  insert into project_geometries (project_id, parent_id, geometry_type, label_en, label_ar, geometry, level, sort_order, status) 
  select proj1_id, (select id from project_geometries where project_id=proj1_id and geometry_type='site' limit 1),
         'building', name_en, name_ar,
         jsonb_build_object('type','Polygon','coordinates',jsonb_build_array(jsonb_build_array(
           jsonb_build_array(center_lng-0.002, center_lat-0.001),
           jsonb_build_array(center_lng+0.002, center_lat-0.001),
           jsonb_build_array(center_lng+0.002, center_lat+0.001),
           jsonb_build_array(center_lng-0.002, center_lat+0.001),
           jsonb_build_array(center_lng-0.002, center_lat-0.001)))),
         1, row_number() over(order by name_en), 'active'
  from buildings where project_id = proj1_id;

  -- Insert map_layer_images sample entries
  insert into map_layer_images (project_id, name_en, name_ar, image_url, image_bounds, opacity, sort_order) values
  (proj1_id, 'Master Plan', 'المخطط العام', '/images/placeholder-masterplan.png',
   jsonb_build_object('north', 24.870, 'south', 24.853, 'east', 46.732, 'west', 46.710),
   0.6, 1);

  -- Link status template to Al Fanar
  update projects set status_template_id = (select id from status_templates where code = 'CONSTRUCTION-DEFAULT' limit 1)
  where id = proj1_id;

  raise notice 'Test data seeded successfully!';
end $$;
