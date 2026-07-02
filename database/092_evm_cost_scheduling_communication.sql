-- 092_evm_cost_scheduling_communication.sql
-- Professional features: EVM, voice calls, smart bot, scheduling, cost management

-- ============================================================
-- 1. EARNED VALUE MANAGEMENT (EVM)
-- ============================================================
CREATE TABLE IF NOT EXISTS evm_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  period DATE NOT NULL,
  planned_value DECIMAL(20,2) DEFAULT 0,
  earned_value DECIMAL(20,2) DEFAULT 0,
  actual_cost DECIMAL(20,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, period)
);

CREATE TABLE IF NOT EXISTS evm_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  baseline_date DATE NOT NULL,
  total_planned_value DECIMAL(20,2) DEFAULT 0,
  budget_at_completion DECIMAL(20,2) DEFAULT 0,
  estimate_at_completion DECIMAL(20,2) DEFAULT 0,
  estimate_to_complete DECIMAL(20,2) DEFAULT 0,
  variance_at_completion DECIMAL(20,2) DEFAULT 0,
  cost_performance_index DECIMAL(6,4) DEFAULT 1.0000,
  schedule_performance_index DECIMAL(6,4) DEFAULT 1.0000,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_cost_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('labor','material','equipment','subcontractor','consultant','overhead','admin','contingency','other')),
  name_en TEXT NOT NULL,
  name_ar TEXT,
  planned_amount DECIMAL(20,2) DEFAULT 0,
  actual_amount DECIMAL(20,2) DEFAULT 0,
  committed_amount DECIMAL(20,2) DEFAULT 0,
  currency TEXT DEFAULT 'SAR',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. VOICE CALLS
-- ============================================================
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID REFERENCES user_profiles(id),
  callee_id UUID REFERENCES user_profiles(id),
  call_type TEXT NOT NULL CHECK (call_type IN ('audio','video','conference')),
  status TEXT NOT NULL DEFAULT 'missed' CHECK (status IN ('ringing','ongoing','completed','missed','rejected','cancelled')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  is_muted BOOLEAN DEFAULT false,
  is_video_on BOOLEAN DEFAULT true
);

-- ============================================================
-- 3. SMART CHAT BOT
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bot_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES chat_bots(id) ON DELETE CASCADE,
  intent_key TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT,
  patterns TEXT[] NOT NULL,
  response_en TEXT NOT NULL,
  response_ar TEXT,
  action_type TEXT CHECK (action_type IN ('reply','create_task','create_log','create_ticket','create_meeting','send_email','webhook')),
  action_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- ============================================================
-- 4. PROFESSIONAL EMAIL ENHANCEMENTS
-- ============================================================
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS scheduled_send_at TIMESTAMPTZ;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS read_receipt_requested BOOLEAN DEFAULT false;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS read_receipt_at TIMESTAMPTZ;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS importance TEXT DEFAULT 'normal' CHECK (importance IN ('low','normal','high'));
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS tracking_id TEXT;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS in_reply_to TEXT;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS message_id TEXT;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS email_templates_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_ar TEXT,
  subject TEXT NOT NULL,
  body_html TEXT,
  variables TEXT[] DEFAULT '{}',
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. SCHEDULING ENHANCEMENTS
-- ============================================================
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS evm_planned_value DECIMAL(14,2) DEFAULT 0;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS evm_earned_value DECIMAL(14,2) DEFAULT 0;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(14,2) DEFAULT 0;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS percent_complete DECIMAL(5,2) DEFAULT 0;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS physical_percent_complete DECIMAL(5,2) DEFAULT 0;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS remaining_duration INTEGER;

ALTER TABLE project_phases ADD COLUMN IF NOT EXISTS planned_value DECIMAL(14,2) DEFAULT 0;
ALTER TABLE project_phases ADD COLUMN IF NOT EXISTS earned_value DECIMAL(14,2) DEFAULT 0;
ALTER TABLE project_phases ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(14,2) DEFAULT 0;

-- ============================================================
-- 6. COST MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS cost_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('monthly','weekly','quarterly','custom')),
  total_budget DECIMAL(20,2) DEFAULT 0,
  total_committed DECIMAL(20,2) DEFAULT 0,
  total_actual DECIMAL(20,2) DEFAULT 0,
  total_forecast DECIMAL(20,2) DEFAULT 0,
  budget_variance DECIMAL(20,2) DEFAULT 0,
  cost_performance_index DECIMAL(6,4) DEFAULT 1.0000,
  schedule_performance_index DECIMAL(6,4) DEFAULT 1.0000,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budget_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  forecast_type TEXT NOT NULL CHECK (forecast_type IN ('optimistic','pessimistic','most_likely')),
  estimate_at_completion DECIMAL(20,2) DEFAULT 0,
  estimate_to_complete DECIMAL(20,2) DEFAULT 0,
  variance_at_completion DECIMAL(20,2) DEFAULT 0,
  assumptions TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 7. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_evm_metrics_project ON evm_metrics(project_id, period);
CREATE INDEX IF NOT EXISTS idx_evm_baselines_project ON evm_baselines(project_id);
CREATE INDEX IF NOT EXISTS idx_cost_items_project ON project_cost_items(project_id);
CREATE INDEX IF NOT EXISTS idx_cost_reports_project ON cost_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_forecasts_project ON budget_forecasts(project_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_caller ON call_logs(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_callee ON call_logs(callee_id);
CREATE INDEX IF NOT EXISTS idx_bot_intents ON bot_intents(bot_id, is_active);

-- ============================================================
-- 8. EVM CALCULATION FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_evm(p_project_id UUID)
RETURNS TABLE(
  period_date DATE,
  planned_value DECIMAL(20,2),
  earned_value DECIMAL(20,2),
  actual_cost DECIMAL(20,2),
  cumulative_pv DECIMAL(20,2),
  cumulative_ev DECIMAL(20,2),
  cumulative_ac DECIMAL(20,2),
  spi DECIMAL(6,4),
  cpi DECIMAL(6,4)
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH monthly_metrics AS (
    SELECT
      date_trunc('month', m.period)::date as month_date,
      SUM(m.planned_value) as pv,
      SUM(m.earned_value) as ev,
      SUM(m.actual_cost) as ac
    FROM evm_metrics m
    WHERE m.project_id = p_project_id
    GROUP BY date_trunc('month', m.period)
    ORDER BY 1
  )
  SELECT
    mm.month_date,
    mm.pv,
    mm.ev,
    mm.ac,
    SUM(mm.pv) OVER (ORDER BY mm.month_date) as cumulative_pv,
    SUM(mm.ev) OVER (ORDER BY mm.month_date) as cumulative_ev,
    SUM(mm.ac) OVER (ORDER BY mm.month_date) as cumulative_ac,
    CASE WHEN SUM(mm.pv) OVER (ORDER BY mm.month_date) > 0
      THEN ROUND((SUM(mm.ev) OVER (ORDER BY mm.month_date) / SUM(mm.pv) OVER (ORDER BY mm.month_date))::numeric, 4)
      ELSE 1.0000 END as spi,
    CASE WHEN SUM(mm.ac) OVER (ORDER BY mm.month_date) > 0
      THEN ROUND((SUM(mm.ev) OVER (ORDER BY mm.month_date) / SUM(mm.ac) OVER (ORDER BY mm.month_date))::numeric, 4)
      ELSE 1.0000 END as cpi
  FROM monthly_metrics mm;
END;
$$;
