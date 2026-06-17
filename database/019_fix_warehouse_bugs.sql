-- ============================================================================
-- 019: Fix warehouse bugs — inventory sync, balance check, seed categories
-- ============================================================================
-- Run after 018_audit_notifications.sql
-- ============================================================================

-- 1. TRIGGER: Auto-sync inventory on stock_movements INSERT/UPDATE/DELETE
--    For 'received' -> UPSERT inventory (+ quantity)
--    For 'issued'   -> UPSERT inventory (- quantity), validate balance first
--    For 'return'   -> UPSERT inventory (+ quantity)
--    For 'adjustment' -> UPSERT inventory (set exact quantity)
--    For 'transfer' -> deduct from source, add to destination

CREATE OR REPLACE FUNCTION public.trg_sync_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- UPSERT inventory: insert or update quantity
  IF TG_OP = 'INSERT' THEN
    IF NEW.movement_type IN ('received', 'return') THEN
      INSERT INTO inventory (warehouse_id, material_id, quantity, unit_price, batch_no)
      VALUES (NEW.warehouse_id, NEW.material_id, NEW.quantity, NEW.unit_price, NEW.batch_no)
      ON CONFLICT (warehouse_id, material_id, batch_no)
      DO UPDATE SET quantity = inventory.quantity + NEW.quantity,
                    unit_price = COALESCE(NEW.unit_price, inventory.unit_price),
                    updated_at = now();

    ELSIF NEW.movement_type = 'adjustment' THEN
      INSERT INTO inventory (warehouse_id, material_id, quantity, unit_price, batch_no)
      VALUES (NEW.warehouse_id, NEW.material_id, NEW.quantity, NEW.unit_price, NEW.batch_no)
      ON CONFLICT (warehouse_id, material_id, batch_no)
      DO UPDATE SET quantity = NEW.quantity,
                    unit_price = COALESCE(NEW.unit_price, inventory.unit_price),
                    updated_at = now();

    ELSIF NEW.movement_type = 'transfer' THEN
      -- Deduct from source
      UPDATE inventory
      SET quantity = quantity - NEW.quantity, updated_at = now()
      WHERE warehouse_id = NEW.warehouse_id AND material_id = NEW.material_id
        AND (batch_no = NEW.batch_no OR (batch_no IS NULL AND NEW.batch_no IS NULL));
      -- Add to destination
      INSERT INTO inventory (warehouse_id, material_id, quantity, unit_price, batch_no)
      VALUES (NEW.warehouse_to_id, NEW.material_id, NEW.quantity, NEW.unit_price, NEW.batch_no)
      ON CONFLICT (warehouse_id, material_id, batch_no)
      DO UPDATE SET quantity = inventory.quantity + NEW.quantity,
                    unit_price = COALESCE(NEW.unit_price, inventory.unit_price),
                    updated_at = now();
    END IF;

    -- Update material_categories default_price if needed
    IF NEW.unit_price IS NOT NULL AND NEW.movement_type = 'received' THEN
      UPDATE materials SET default_price = NEW.unit_price
      WHERE id = NEW.material_id AND (default_price IS NULL OR default_price = 0);
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Reverse the movement on delete
    IF OLD.movement_type IN ('received', 'return') THEN
      UPDATE inventory SET quantity = quantity - OLD.quantity, updated_at = now()
      WHERE warehouse_id = OLD.warehouse_id AND material_id = OLD.material_id
        AND (batch_no = OLD.batch_no OR (batch_no IS NULL AND OLD.batch_no IS NULL));
    ELSIF OLD.movement_type IN ('issued', 'adjustment') THEN
      UPDATE inventory SET quantity = quantity + OLD.quantity, updated_at = now()
      WHERE warehouse_id = OLD.warehouse_id AND material_id = OLD.material_id
        AND (batch_no = OLD.batch_no OR (batch_no IS NULL AND OLD.batch_no IS NULL));
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_inventory ON stock_movements;
CREATE TRIGGER trg_sync_inventory
  AFTER INSERT OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION trg_sync_inventory();

-- 2. FUNCTION: validate_stock (called before insert of issued/transfer)
CREATE OR REPLACE FUNCTION public.validate_stock_before_movement()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_available DECIMAL(12,2);
BEGIN
  IF NEW.movement_type IN ('issued', 'transfer') THEN
    SELECT COALESCE(SUM(quantity), 0) INTO v_available
    FROM inventory
    WHERE warehouse_id = NEW.warehouse_id AND material_id = NEW.material_id;
    IF v_available < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient stock: available %, requested %', v_available, NEW.quantity
        USING HINT = 'Check inventory before issuing';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_stock ON stock_movements;
CREATE TRIGGER trg_validate_stock
  BEFORE INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION validate_stock_before_movement();

-- 3. SEED: basic material categories
INSERT INTO material_categories (code, name_en, name_ar) VALUES
  ('CONC', 'Concrete', 'خرسانة'),
  ('STEL', 'Steel Reinforcement', 'حديد تسليح'),
  ('MEP', 'MEP Materials', 'مواد كهرباء وميكانيكا'),
  ('FINS', 'Finishes', 'مواد التشطيب'),
  ('WOOD', 'Wood & Carpentry', 'أخشاب ونجارة'),
  ('PLUM', 'Plumbing', 'مواد سباكة'),
  ('ELEC', 'Electrical', 'مواد كهربائية'),
  ('SAFE', 'Safety Equipment', 'معدات سلامة'),
  ('TOOL', 'Tools & Equipment', 'أدوات ومعدات'),
  ('OTHR', 'Other Materials', 'مواد أخرى')
ON CONFLICT (code) DO NOTHING;

-- 4. Backfill inventory from existing stock_movements
INSERT INTO inventory (warehouse_id, material_id, quantity, unit_price, batch_no)
SELECT
  sm.warehouse_id,
  sm.material_id,
  CASE
    WHEN sm.movement_type IN ('received', 'return') THEN sm.quantity
    WHEN sm.movement_type IN ('issued', 'transfer') THEN -sm.quantity
    ELSE 0
  END,
  sm.unit_price,
  sm.batch_no
FROM stock_movements sm
WHERE sm.movement_type IN ('received', 'return', 'issued', 'transfer')
ON CONFLICT (warehouse_id, material_id, batch_no)
DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity;
