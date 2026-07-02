-- ============================================================================
-- 039: Workflow Automation Triggers
-- Automatically log interactions and create tasks on CRM/support events
-- ============================================================================

-- 1. When deal stage changes → log interaction
CREATE OR REPLACE FUNCTION auto_log_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_name_en VARCHAR(100);
  v_old_stage_name_en VARCHAR(100);
BEGIN
  SELECT name_en INTO v_stage_name_en FROM crm_pipeline_stages WHERE id = NEW.pipeline_stage_id;
  SELECT name_en INTO v_old_stage_name_en FROM crm_pipeline_stages WHERE id = OLD.pipeline_stage_id;

  INSERT INTO crm_interactions (interaction_type, subject, description, contact_id, company_id, deal_id, interaction_date, direction, created_by)
  VALUES (
    'note',
    'Deal moved: ' || COALESCE(v_old_stage_name_en, '?') || ' → ' || COALESCE(v_stage_name_en, '?'),
    'Automatically logged: deal "' || NEW.deal_name || '" moved from "' || COALESCE(v_old_stage_name_en, '?') || '" to "' || COALESCE(v_stage_name_en, '?') || '".',
    NEW.contact_id,
    NEW.company_id,
    NEW.id,
    NOW(),
    'outbound',
    NEW.assigned_to
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_stage_change ON crm_deals;
CREATE TRIGGER trg_deal_stage_change
  AFTER UPDATE OF pipeline_stage_id ON crm_deals
  FOR EACH ROW
  WHEN (OLD.pipeline_stage_id IS DISTINCT FROM NEW.pipeline_stage_id)
  EXECUTE FUNCTION auto_log_stage_change();

-- 2. When deal is won → create follow-up task
CREATE OR REPLACE FUNCTION auto_task_deal_won()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO crm_tasks (task_type, subject, description, contact_id, company_id, deal_id, due_date, priority, status, assigned_to)
  VALUES (
    'follow_up',
    'Follow up on won deal: ' || NEW.deal_name,
    'Automatically created: deal "' || NEW.deal_name || '" was won. Schedule handover and next steps.',
    NEW.contact_id,
    NEW.company_id,
    NEW.id,
    (NOW() + INTERVAL '7 days')::DATE,
    'high',
    'pending',
    NEW.assigned_to
  );

  INSERT INTO crm_interactions (interaction_type, subject, description, contact_id, company_id, deal_id, interaction_date, direction, created_by)
  VALUES (
    'note',
    'Deal won: ' || NEW.deal_name,
    'Automatically logged: deal "' || NEW.deal_name || '" marked as won.',
    NEW.contact_id,
    NEW.company_id,
    NEW.id,
    NOW(),
    'outbound',
    NEW.assigned_to
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_won ON crm_deals;
CREATE TRIGGER trg_deal_won
  AFTER UPDATE OF is_won ON crm_deals
  FOR EACH ROW
  WHEN (OLD.is_won = false AND NEW.is_won = true)
  EXECUTE FUNCTION auto_task_deal_won();

-- 3. When deal is lost → log reason interaction
CREATE OR REPLACE FUNCTION auto_task_deal_lost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO crm_interactions (interaction_type, subject, description, contact_id, company_id, deal_id, interaction_date, direction, created_by)
  VALUES (
    'note',
    'Deal lost: ' || NEW.deal_name,
    'Automatically logged: deal "' || NEW.deal_name || '" marked as lost.' || CASE WHEN NEW.loss_reason IS NOT NULL THEN ' Reason: ' || NEW.loss_reason ELSE '' END,
    NEW.contact_id,
    NEW.company_id,
    NEW.id,
    NOW(),
    'inbound',
    NEW.assigned_to
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_lost ON crm_deals;
CREATE TRIGGER trg_deal_lost
  AFTER UPDATE OF is_lost ON crm_deals
  FOR EACH ROW
  WHEN (OLD.is_lost = false AND NEW.is_lost = true)
  EXECUTE FUNCTION auto_task_deal_lost();

-- 4. When ticket is escalated → create urgent task
CREATE OR REPLACE FUNCTION auto_task_ticket_escalated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO crm_tasks (task_type, subject, description, contact_id, company_id, deal_id, due_date, priority, status, assigned_to)
  VALUES (
    'follow_up',
    'Escalated ticket: ' || NEW.subject,
    'Automatically created: ticket "' || NEW.ticket_number || '" was escalated. Immediate attention required.',
    NEW.contact_id,
    NEW.company_id,
    NEW.deal_id,
    NOW()::DATE,
    'urgent',
    'pending',
    NEW.assigned_to
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_escalated ON support_tickets;
CREATE TRIGGER trg_ticket_escalated
  AFTER UPDATE OF is_escalated ON support_tickets
  FOR EACH ROW
  WHEN (OLD.is_escalated = false AND NEW.is_escalated = true)
  EXECUTE FUNCTION auto_task_ticket_escalated();

-- 5. When ticket is resolved → log interaction
CREATE OR REPLACE FUNCTION auto_log_ticket_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO crm_interactions (interaction_type, subject, description, contact_id, company_id, deal_id, interaction_date, direction, created_by)
  VALUES (
    'note',
    'Ticket resolved: ' || NEW.subject,
    'Automatically logged: ticket "' || NEW.ticket_number || '" was resolved.',
    NEW.contact_id,
    NEW.company_id,
    NEW.deal_id,
    NOW(),
    'inbound',
    NEW.assigned_to
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_resolved ON support_tickets;
CREATE TRIGGER trg_ticket_resolved
  AFTER UPDATE OF status ON support_tickets
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'resolved')
  EXECUTE FUNCTION auto_log_ticket_resolved();
