-- 113: Drop triggers that cause batch inserts to fail via REST.
-- sync_geometry_to_unit: fires on project_geometries INSERT, tries to INSERT into units.
-- When this trigger fails (even for 1 row out of 100), the entire batch is rolled back silently.
-- sync_unit_to_geometry: fires on units INSERT/UPDATE, tries to INSERT into project_geometries.
-- Same failure mode for batch unit operations.
-- Both syncs are handled in application code (generateAndSyncUnits, autoGenerateUnits).

DROP TRIGGER IF EXISTS trg_sync_geometry_to_unit ON project_geometries;
DROP TRIGGER IF EXISTS trg_sync_unit_to_geometry ON units;

-- Also clean up the trigger functions (optional, keep them for reference)
-- DROP FUNCTION IF EXISTS sync_geometry_to_unit;
-- DROP FUNCTION IF EXISTS sync_unit_to_geometry;
