-- Admin cleanup: keep only one project (replace PROJECT_ID_TO_KEEP) and delete everything else
-- Run via: Get-Content scripts\cleanup_test_data.sql | supabase db query --linked

-- STEP 1: Set the project ID you want to keep
-- Find your project ID first:
-- SELECT id, project_code, name_en FROM projects;

-- Then set it here:
-- DO $$ BEGIN PERFORM set_config('app.keep_project', 'REPLACE_WITH_YOUR_PROJECT_ID', false); END; $$;

-- STEP 2: Delete all units NOT in the kept project
-- DELETE FROM units WHERE project_id <> current_setting('app.keep_project');

-- STEP 3: Delete all project_geometries NOT in the kept project
-- DELETE FROM project_geometries WHERE project_id <> current_setting('app.keep_project');

-- STEP 4: Delete all other related data NOT in the kept project
-- DELETE FROM buildings WHERE project_id <> current_setting('app.keep_project');
-- DELETE FROM floors WHERE building_id IN (SELECT id FROM buildings WHERE project_id <> current_setting('app.keep_project'));
-- DELETE FROM blocks WHERE project_id <> current_setting('app.keep_project');
-- DELETE FROM map_annotations WHERE project_id <> current_setting('app.keep_project');

-- STEP 5: Delete other projects
-- DELETE FROM projects WHERE id <> current_setting('app.keep_project');

-- ── OR use this simpler version: just delete everything test-related ──

-- Delete ALL units (from the Units page)
-- DELETE FROM units;

-- Delete ALL geometries (from the map)
-- DELETE FROM project_geometries;

-- Delete ALL buildings and floors
-- DELETE FROM floors;
-- DELETE FROM buildings;
-- DELETE FROM blocks;

-- Delete ALL projects (cascades to everything above)
-- DELETE FROM projects;
