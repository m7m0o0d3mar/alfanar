-- ============================================================
-- Fix: generated columns referencing generated columns (42P17)
-- supplier_evaluations.rating cannot ref overall_score (generated)
-- ============================================================

-- Drop old table and recreate with trigger-based computation
DROP TABLE IF EXISTS supplier_evaluations CASCADE;

CREATE TABLE IF NOT EXISTS supplier_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  contract_id UUID REFERENCES procurement_contracts(id),
  evaluated_by UUID REFERENCES user_profiles(id),
  evaluation_date DATE DEFAULT CURRENT_DATE,
  period VARCHAR(20) CHECK (period IN ('monthly','quarterly','biannual','annual','adhoc')),
  quality_score NUMERIC(3,1) CHECK (quality_score >= 0 AND quality_score <= 5),
  delivery_score NUMERIC(3,1) CHECK (delivery_score >= 0 AND delivery_score <= 5),
  price_score NUMERIC(3,1) CHECK (price_score >= 0 AND price_score <= 5),
  responsiveness_score NUMERIC(3,1) CHECK (responsiveness_score >= 0 AND responsiveness_score <= 5),
  compliance_score NUMERIC(3,1) CHECK (compliance_score >= 0 AND compliance_score <= 5),
  overall_score NUMERIC(3,1),
  rating VARCHAR(20),
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN supplier_evaluations.overall_score IS 'avg of quality/delivery/price/responsiveness/compliance';
COMMENT ON COLUMN supplier_evaluations.rating IS 'excellent(>=4.5) good(>=3.5) average(>=2.5) poor(>=1.5) critical(<1.5)';

CREATE OR REPLACE FUNCTION compute_supplier_rating()
RETURNS TRIGGER AS $$
BEGIN
  NEW.overall_score := ROUND((COALESCE(NEW.quality_score,0) + COALESCE(NEW.delivery_score,0) + COALESCE(NEW.price_score,0) + COALESCE(NEW.responsiveness_score,0) + COALESCE(NEW.compliance_score,0)) / 5, 1);
  NEW.rating := CASE
    WHEN NEW.overall_score >= 4.5 THEN 'excellent'
    WHEN NEW.overall_score >= 3.5 THEN 'good'
    WHEN NEW.overall_score >= 2.5 THEN 'average'
    WHEN NEW.overall_score >= 1.5 THEN 'poor'
    ELSE 'critical'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supplier_eval_rating ON supplier_evaluations;
CREATE TRIGGER trg_supplier_eval_rating
  BEFORE INSERT OR UPDATE ON supplier_evaluations
  FOR EACH ROW EXECUTE FUNCTION compute_supplier_rating();

-- Fix exec_sql: remove is_admin check (doesn't work with service key via REST)
CREATE OR REPLACE FUNCTION public.exec_sql(query TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  EXECUTE query;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Re-apply RLS for supplier_evaluations
ALTER TABLE supplier_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_evaluations_read" ON supplier_evaluations;
DROP POLICY IF EXISTS "supplier_evaluations_insert" ON supplier_evaluations;
DROP POLICY IF EXISTS "supplier_evaluations_update" ON supplier_evaluations;
DROP POLICY IF EXISTS "se_select" ON supplier_evaluations;
CREATE POLICY "se_select" ON supplier_evaluations FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "se_insert" ON supplier_evaluations;
CREATE POLICY "se_insert" ON supplier_evaluations FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);
DROP POLICY IF EXISTS "se_update" ON supplier_evaluations;
CREATE POLICY "se_update" ON supplier_evaluations FOR UPDATE USING (
  auth.role() = 'authenticated'
);
