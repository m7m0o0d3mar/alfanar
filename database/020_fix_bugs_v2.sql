-- ============================================================================
-- 020: Fix critical bugs v2 — exec_sql, dark mode, notifications, inventory
-- ============================================================================
-- Run after 019_fix_warehouse_bugs.sql
-- ============================================================================

-- 1. Redeploy exec_sql for SQL Editor
DROP FUNCTION IF EXISTS public.exec_sql(TEXT) CASCADE;
CREATE FUNCTION public.exec_sql(query TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  EXECUTE query;
  result := '{"success": true}'::json;
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  result := json_build_object('success', false, 'error', SQLERRM);
  RETURN result;
END;
$$;

-- 2. View: inventory_balance — aggregated net quantities
DROP VIEW IF EXISTS inventory_balance;
CREATE VIEW inventory_balance AS
SELECT
  i.material_id,
  i.warehouse_id,
  m.code AS material_code,
  m.name_en AS material_name,
  m.unit,
  w.code AS warehouse_code,
  w.name_en AS warehouse_name,
  SUM(i.quantity) AS net_quantity,
  COALESCE(AVG(i.unit_price), 0) AS avg_unit_price,
  COUNT(*) AS batch_count
FROM inventory i
JOIN materials m ON m.id = i.material_id
JOIN warehouses w ON w.id = i.warehouse_id
GROUP BY i.material_id, i.warehouse_id, m.code, m.name_en, m.unit, w.code, w.name_en;

-- 3. Notification triggers for NCRs, WIRs, low stock
CREATE OR REPLACE FUNCTION public.trg_notify_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_material_code VARCHAR;
BEGIN
  SELECT code INTO v_material_code FROM materials WHERE id = NEW.material_id;
  IF NEW.quantity < NEW.min_quantity THEN
    INSERT INTO notifications (user_id, title, body, type, entity_type, entity_id)
    SELECT up.id, 'Low Stock Alert',
      'Material ' || COALESCE(v_material_code, 'unknown') || ' below minimum (' || NEW.quantity || ' < ' || NEW.min_quantity || ')',
      'warning', 'inventory', NEW.id
    FROM user_profiles up
    WHERE up.role IN ('admin', 'warehouse_manager');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_low_stock ON inventory;
CREATE TRIGGER trg_notify_low_stock
  AFTER INSERT OR UPDATE OF quantity ON inventory
  FOR EACH ROW EXECUTE FUNCTION trg_notify_low_stock();

-- Generate notifications for existing open NCRs (>7 days old)
INSERT INTO notifications (user_id, title, body, type, entity_type, entity_id)
SELECT
  up.id,
  'Open NCR Reminder',
  'NCR ' || wr.wir_no || ' is still open (created ' || wr.request_date || ')',
  'warning', 'work_requests', wr.id
FROM user_profiles up
CROSS JOIN work_requests wr
WHERE wr.is_ncr = true AND wr.status = 'open'
  AND wr.request_date < CURRENT_DATE - INTERVAL '7 days'
  AND up.role IN ('admin', 'quality')
;
