-- ============================================================================
-- 036: CRM Enhancements - Support Tickets, Lead Scoring, Analytics Views
-- ============================================================================

-- ============================================================================
-- SUPPORT TICKETS (omnichannel case management like Hollat)
-- ============================================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(20) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  channel VARCHAR(20) NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'email', 'phone', 'whatsapp', 'chat', 'portal', 'other')),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  severity VARCHAR(20) DEFAULT 'minor' CHECK (severity IN ('minor', 'major', 'critical', 'blocker')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'waiting_third_party', 'resolved', 'closed', 'cancelled')),
  category VARCHAR(100),
  sub_category VARCHAR(100),
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES user_profiles(id),
  created_by UUID REFERENCES user_profiles(id),
  sla_policy VARCHAR(50),
  sla_respond_by TIMESTAMPTZ,
  sla_resolve_by TIMESTAMPTZ,
  first_responded_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  is_escalated BOOLEAN DEFAULT false,
  escalation_reason TEXT,
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ticket_number auto-generation function
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  next_seq := COALESCE(
    (SELECT MAX(NULLIF(regexp_replace(ticket_number, '^TKT-', ''), ''))::INTEGER FROM support_tickets),
    0
  ) + 1;
  NEW.ticket_number := 'TKT-' || LPAD(next_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_tickets_number ON support_tickets;
CREATE TRIGGER trg_support_tickets_number
  BEFORE INSERT ON support_tickets
  FOR EACH ROW
  WHEN (NEW.ticket_number IS NULL OR NEW.ticket_number = '')
  EXECUTE FUNCTION generate_ticket_number();

-- ============================================================================
-- TICKET COMMENTS / ACTIVITY
-- ============================================================================

CREATE TABLE IF NOT EXISTS ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  author_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CRM LEAD SCORING (AI-powered lead scoring engine)
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_lead_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  engagement_score INTEGER DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
  fit_score INTEGER DEFAULT 0 CHECK (fit_score >= 0 AND fit_score <= 100),
  intent_score INTEGER DEFAULT 0 CHECK (intent_score >= 0 AND intent_score <= 100),
  last_activity_date TIMESTAMPTZ,
  interaction_count INTEGER DEFAULT 0,
  scoring_version INTEGER DEFAULT 1,
  last_scored_at TIMESTAMPTZ DEFAULT NOW(),
  score_factors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_lead_scores_contact_id ON crm_lead_scores(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_scores_score ON crm_lead_scores(score DESC);

-- ============================================================================
-- FUNCTION: Auto-calculate lead scores based on interactions
-- ============================================================================

CREATE OR REPLACE FUNCTION recalc_lead_score(p_contact_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_interaction_count INTEGER;
  v_deal_amount NUMERIC;
  v_engagement INTEGER;
  v_fit INTEGER;
  v_intent INTEGER;
  v_total_score INTEGER;
  v_last_activity TIMESTAMPTZ;
BEGIN
  SELECT COUNT(*), MAX(interaction_date)
  INTO v_interaction_count, v_last_activity
  FROM crm_interactions WHERE contact_id = p_contact_id;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_deal_amount
  FROM crm_deals WHERE contact_id = p_contact_id AND is_won = false AND is_lost = false;

  v_engagement := LEAST(v_interaction_count * 10, 100);
  v_fit := CASE WHEN v_deal_amount > 0 THEN LEAST((v_deal_amount / 100000)::INTEGER * 5, 100) ELSE 0 END;
  v_intent := CASE WHEN v_interaction_count > 5 THEN 80 WHEN v_interaction_count > 2 THEN 50 ELSE 20 END;
  v_total_score := (v_engagement * 0.4 + v_fit * 0.3 + v_intent * 0.3)::INTEGER;

  INSERT INTO crm_lead_scores (contact_id, score, engagement_score, fit_score, intent_score, interaction_count, last_activity_date, last_scored_at)
  VALUES (p_contact_id, v_total_score, v_engagement, v_fit, v_intent, v_interaction_count, v_last_activity, NOW())
  ON CONFLICT (contact_id)
  DO UPDATE SET
    score = v_total_score,
    engagement_score = v_engagement,
    fit_score = v_fit,
    intent_score = v_intent,
    interaction_count = v_interaction_count,
    last_activity_date = v_last_activity,
    last_scored_at = NOW(),
    updated_at = NOW();

  RETURN v_total_score;
END;
$$;

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW v_crm_pipeline_analytics AS
SELECT
  ps.id AS stage_id,
  ps.name_en AS stage_name,
  ps.name_ar AS stage_name_ar,
  ps.sort_order,
  ps.color,
  COUNT(d.id) AS deal_count,
  COALESCE(SUM(d.amount), 0) AS total_amount,
  COALESCE(AVG(d.amount), 0) AS avg_deal_amount,
  COUNT(d.id) FILTER (WHERE d.created_at >= NOW() - INTERVAL '30 days') AS new_deals_30d,
  COUNT(d.id) FILTER (WHERE DATE_TRUNC('month', d.created_at) = DATE_TRUNC('month', NOW())) AS new_deals_this_month,
  COUNT(d.id) FILTER (WHERE d.is_won = true) AS won_deals,
  COUNT(d.id) FILTER (WHERE d.is_lost = true) AS lost_deals
FROM crm_pipeline_stages ps
LEFT JOIN crm_deals d ON d.pipeline_stage_id = ps.id AND d.is_lost = false AND d.is_won = false
GROUP BY ps.id, ps.name_en, ps.name_ar, ps.sort_order, ps.color
ORDER BY ps.sort_order;

CREATE OR REPLACE VIEW v_crm_sales_kpis AS
SELECT
  COUNT(DISTINCT d.id) AS total_deals,
  COUNT(DISTINCT d.id) FILTER (WHERE d.is_won = true) AS won_deals,
  COUNT(DISTINCT d.id) FILTER (WHERE d.is_lost = true) AS lost_deals,
  COUNT(DISTINCT d.id) FILTER (WHERE d.is_won = false AND d.is_lost = false) AS open_deals,
  COALESCE(SUM(d.amount) FILTER (WHERE d.is_won = true), 0) AS won_amount,
  COALESCE(SUM(d.amount) FILTER (WHERE d.is_won = false AND d.is_lost = false), 0) AS pipeline_value,
  COALESCE(SUM(d.amount) FILTER (WHERE d.is_won = true), 0) +
  COALESCE(SUM(d.amount) FILTER (WHERE d.is_won = false AND d.is_lost = false), 0) AS total_pipeline,
  CASE
    WHEN COUNT(DISTINCT d.id) > 0
    THEN ROUND(COUNT(DISTINCT d.id) FILTER (WHERE d.is_won = true) * 100.0 / COUNT(DISTINCT d.id), 1)
    ELSE 0
  END AS win_rate,
  COUNT(DISTINCT c.id) AS total_companies,
  COUNT(DISTINCT ct.id) AS total_contacts,
  COUNT(DISTINCT i.id) AS total_interactions,
  COUNT(DISTINCT t.id) AS total_tasks,
  COUNT(DISTINCT s.id) AS total_tickets
FROM crm_deals d
CROSS JOIN (SELECT COUNT(*) AS id FROM crm_companies) c
CROSS JOIN (SELECT COUNT(*) AS id FROM crm_contacts) ct
CROSS JOIN (SELECT COUNT(*) AS id FROM crm_interactions) i
CROSS JOIN (SELECT COUNT(*) AS id FROM crm_tasks) t
CROSS JOIN (SELECT COUNT(*) AS id FROM support_tickets) s;

CREATE OR REPLACE VIEW v_support_kpis AS
SELECT
  COUNT(*) AS total_tickets,
  COUNT(*) FILTER (WHERE status = 'open') AS open_tickets,
  COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_tickets,
  COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_tickets,
  COUNT(*) FILTER (WHERE status = 'closed') AS closed_tickets,
  COUNT(*) FILTER (WHERE is_escalated = true) AS escalated_tickets,
  COUNT(*) FILTER (WHERE priority = 'urgent' AND status NOT IN ('resolved', 'closed', 'cancelled')) AS urgent_open_tickets,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS tickets_7d,
  ROUND(
    COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) * 100.0 /
    NULLIF(COUNT(*), 0), 1
  ) AS resolution_rate
FROM support_tickets;

-- ============================================================================
-- RLS: support_tickets
-- ============================================================================

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_lead_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets_select" ON support_tickets;
CREATE POLICY "support_tickets_select" ON support_tickets FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "support_tickets_insert" ON support_tickets;
CREATE POLICY "support_tickets_insert" ON support_tickets FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "support_tickets_update" ON support_tickets;
CREATE POLICY "support_tickets_update" ON support_tickets FOR UPDATE USING (is_admin() OR assigned_to = auth.uid() OR created_by = auth.uid());

DROP POLICY IF EXISTS "support_tickets_delete" ON support_tickets;
CREATE POLICY "support_tickets_delete" ON support_tickets FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS "ticket_comments_select" ON ticket_comments;
CREATE POLICY "ticket_comments_select" ON ticket_comments FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "ticket_comments_insert" ON ticket_comments;
CREATE POLICY "ticket_comments_insert" ON ticket_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "ticket_comments_delete" ON ticket_comments;
CREATE POLICY "ticket_comments_delete" ON ticket_comments FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS "crm_lead_scores_select" ON crm_lead_scores;
CREATE POLICY "crm_lead_scores_select" ON crm_lead_scores FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "crm_lead_scores_insert" ON crm_lead_scores;
CREATE POLICY "crm_lead_scores_insert" ON crm_lead_scores FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "crm_lead_scores_update" ON crm_lead_scores;
CREATE POLICY "crm_lead_scores_update" ON crm_lead_scores FOR UPDATE USING (is_admin());

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_contact_id ON support_tickets(contact_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_company_id ON support_tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_channel ON support_tickets(channel);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);

-- ============================================================================
-- SEED: Default pipeline stages (if not exist)
-- ============================================================================

INSERT INTO crm_pipeline_stages (name_en, name_ar, sort_order, color, probability)
SELECT * FROM (VALUES
  ('Lead Qualification', 'تأهيل العميل', 1, '#6B7280', 10.00),
  ('Needs Assessment', 'تقييم الاحتياجات', 2, '#3B82F6', 20.00),
  ('Proposal Sent', 'إرسال العرض', 3, '#F59E0B', 40.00),
  ('Negotiation', 'التفاوض', 4, '#8B5CF6', 60.00),
  ('Contract Review', 'مراجعة العقد', 5, '#EC4899', 80.00),
  ('Won', 'فوز', 6, '#10B981', 100.00),
  ('Lost', 'خسارة', 7, '#EF4444', 0.00)
) AS s(name_en, name_ar, sort_order, color, probability)
WHERE NOT EXISTS (
  SELECT 1 FROM crm_pipeline_stages WHERE name_en = s.name_en
);
