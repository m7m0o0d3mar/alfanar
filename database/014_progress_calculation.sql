-- ============================================================================
-- FIX: Dynamic progress calculation based on work_tasks completion
-- ============================================================================

-- Function: calculate project progress from task completion ratio
CREATE OR REPLACE FUNCTION public.calc_project_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_tasks INT;
    completed_tasks INT;
    new_progress DECIMAL(5,2);
BEGIN
    -- Get task counts for the project
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed')
    INTO total_tasks, completed_tasks
    FROM work_tasks
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id);

    -- Calculate progress percentage
    IF total_tasks > 0 THEN
        new_progress := (completed_tasks::DECIMAL / total_tasks::DECIMAL) * 100;
    ELSE
        new_progress := 0;
    END IF;

    -- Update the project progress
    UPDATE projects 
    SET progress_percent = new_progress,
        updated_at = now()
    WHERE id = COALESCE(NEW.project_id, OLD.project_id);

    RETURN NEW;
END;
$$;

-- Trigger on work_tasks: update progress when task status changes
DROP TRIGGER IF EXISTS trg_work_tasks_progress ON work_tasks;
CREATE TRIGGER trg_work_tasks_progress
    AFTER INSERT OR UPDATE OF status OR DELETE
    ON work_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.calc_project_progress();

-- Also calculate from unit_progress as a secondary method
CREATE OR REPLACE FUNCTION public.calc_unit_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_project_id UUID;
    total_milestones INT;
    completed_milestones INT;
    unit_progress DECIMAL(5,2);
BEGIN
    -- Get the project_id from the unit
    SELECT project_id INTO v_project_id FROM units WHERE id = NEW.unit_id;

    -- Count milestones for this unit
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed')
    INTO total_milestones, completed_milestones
    FROM unit_progress
    WHERE unit_id = NEW.unit_id;

    IF total_milestones > 0 THEN
        unit_progress := (completed_milestones::DECIMAL / total_milestones::DECIMAL) * 100;
        -- Optionally update a unit progress field or average into project
    END IF;

    RETURN NEW;
END;
$$;

-- Seed existing progress for projects that already have tasks
UPDATE projects p
SET progress_percent = sub.progress,
    updated_at = now()
FROM (
    SELECT 
        wt.project_id,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                (COUNT(*) FILTER (WHERE wt.status = 'completed')::DECIMAL / COUNT(*)::DECIMAL) * 100
            ELSE 0
        END as progress
    FROM work_tasks wt
    GROUP BY wt.project_id
) sub
WHERE p.id = sub.project_id;
