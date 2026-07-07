-- ============================================================================
-- FULL DATABASE CLEANUP — keeps only admin mahmoud.abdelaziz@alfanar.com
-- ============================================================================
-- Uses topological sort to delete in correct FK dependency order
-- Run via: Get-Content scripts\wipe_all_data.sql -Raw | supabase db query --linked
-- ============================================================================
DO $$
DECLARE
    tbl TEXT;
    deleted_count INTEGER;
    total_count INTEGER;
    pass INTEGER := 0;
    max_passes CONSTANT INTEGER := 50;
    tables_done TEXT[] := '{}';
    all_tables TEXT[] := '{}';
    admin_id CONSTANT TEXT := '2166c66a-5483-4446-b3c3-c9d3687f5229';
BEGIN
    -- Get all user_facing tables (exclude core/config tables)
    SELECT array_agg(table_name ORDER BY table_name) INTO all_tables
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('schema_migrations', 'user_profiles');

    RAISE NOTICE 'Starting cleanup of % tables...', array_length(all_tables, 1);

    -- Multi-pass delete: skip tables that fail FK constraints, retry later
    LOOP
        pass := pass + 1;
        IF pass > max_passes THEN
            RAISE NOTICE 'Max passes reached. Remaining tables may have circular deps.';
            EXIT;
        END IF;

        deleted_count := 0;

        FOREACH tbl IN ARRAY all_tables
        LOOP
            -- Skip already-cleared tables
            IF tbl = ANY(tables_done) THEN
                CONTINUE;
            END IF;

            BEGIN
                EXECUTE format('DELETE FROM %I', tbl);
                GET DIAGNOSTICS total_count = ROW_COUNT;
                IF total_count > 0 THEN
                    deleted_count := deleted_count + total_count;
                    RAISE NOTICE '  %: % rows deleted', tbl, total_count;
                END IF;
                tables_done := tables_done || tbl;
            EXCEPTION
                WHEN foreign_key_violation THEN
                    -- Defer to next pass
                    NULL;
                WHEN others THEN
                    -- Log unexpected errors but continue
                    RAISE NOTICE '  %: unexpected error: %', tbl, SQLERRM;
            END;
        END LOOP;

        -- Exit if all tables processed
        IF array_length(tables_done, 1) >= array_length(all_tables, 1) THEN
            RAISE NOTICE 'All % tables processed.', array_length(all_tables, 1);
            EXIT;
        END IF;

        -- Exit if no progress (circular dependency)
        IF deleted_count = 0 THEN
            RAISE NOTICE 'No progress in pass %. Remaining: %', pass, 
                array_length(all_tables, 1) - array_length(tables_done, 1);
            EXIT;
        END IF;

        RAISE NOTICE 'Pass % complete, % rows deleted. % tables remain.', 
            pass, deleted_count, array_length(all_tables, 1) - array_length(tables_done, 1);
    END LOOP;

    -- Delete non-admin user profiles (handled separately since it's referenced by many)
    DELETE FROM user_profiles WHERE id <> admin_id::uuid;
    GET DIAGNOSTICS total_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % non-admin user profiles.', total_count;

    RAISE NOTICE 'Cleanup complete.';
END;
$$;
