-- BUG-M4: Fix inventory AVG PRICE showing 0.00 SAR

-- Backfill inventory.unit_price from materials.default_price where missing
UPDATE inventory SET unit_price = m.default_price
FROM materials m WHERE inventory.material_id = m.id
AND (inventory.unit_price = 0 OR inventory.unit_price IS NULL);

-- Update inventory_balance view to fall back to materials.default_price
DROP VIEW IF EXISTS inventory_balance;
CREATE VIEW inventory_balance AS
SELECT
  i.material_id,
  i.warehouse_id,
  m.code AS material_code,
  m.name_en AS material_name,
  m.unit,
  m.default_price,
  w.code AS warehouse_code,
  w.name_en AS warehouse_name,
  SUM(i.quantity) AS net_quantity,
  COALESCE(NULLIF(AVG(i.unit_price), 0), m.default_price, 0) AS avg_unit_price,
  COUNT(*) AS batch_count
FROM inventory i
JOIN materials m ON m.id = i.material_id
JOIN warehouses w ON w.id = i.warehouse_id
GROUP BY i.material_id, i.warehouse_id, m.code, m.name_en, m.unit, m.default_price, w.code, w.name_en;
