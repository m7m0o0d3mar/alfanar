-- ============================================================================
-- FIX: RLS infinite recursion (approval_requests <-> approval_steps)
--      + any remaining missing policies for modules
-- ============================================================================
-- Run this in Supabase SQL Editor after 012-015
-- ============================================================================

-- 1. SECURITY DEFINER helpers to break circular RLS dependencies

-- Safe check: can the current user view this approval_request?
DROP FUNCTION IF EXISTS public.can_view_approval_request(UUID) CASCADE;
CREATE FUNCTION public.can_view_approval_request(req_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM approval_requests ar
    WHERE ar.id = req_id
      AND (ar.requested_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM approval_steps aps
          WHERE aps.approval_request_id = ar.id
            AND (aps.step_user_id = auth.uid() OR aps.step_role = current_user_role())
        ))
  );
$$;

-- Safe check: can the current user view this approval_step?
DROP FUNCTION IF EXISTS public.can_view_approval_step(UUID) CASCADE;
CREATE FUNCTION public.can_view_approval_step(step_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM approval_steps aps
    JOIN approval_requests ar ON ar.id = aps.approval_request_id
    WHERE aps.id = step_id
      AND (ar.requested_by = auth.uid() OR aps.step_user_id = auth.uid())
  );
$$;

-- 2. Fix approval_requests SELECT policy (break circular dependency)
DROP POLICY IF EXISTS "approval_requests_select" ON approval_requests;
CREATE POLICY "approval_requests_select" ON approval_requests FOR SELECT USING (
  is_admin() OR can_view_approval_request(id)
);

-- 3. Fix approval_steps SELECT policy (break circular dependency)
DROP POLICY IF EXISTS "approval_steps_select" ON approval_steps;
CREATE POLICY "approval_steps_select" ON approval_steps FOR SELECT USING (
  is_admin() OR can_view_approval_step(id)
);

-- 4. Ensure all other approval policies are correct
DROP POLICY IF EXISTS "approval_requests_insert" ON approval_requests;
CREATE POLICY "approval_requests_insert" ON approval_requests FOR INSERT WITH CHECK (
  is_admin() OR auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "approval_requests_update" ON approval_requests;
CREATE POLICY "approval_requests_update" ON approval_requests FOR UPDATE USING (
  is_admin() OR requested_by = auth.uid()
);

DROP POLICY IF EXISTS "approval_steps_update" ON approval_steps;
CREATE POLICY "approval_steps_update" ON approval_steps FOR UPDATE USING (
  is_admin() OR step_user_id = auth.uid()
);

-- 5. Fix any remaining INSERT policies for modules that might still fail
-- These use a simple authenticated bypass (safe for dev; tighten for production)

DO $$
BEGIN
  -- contract_invoices INSERT for non-admin
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'contract_invoices_insert_auth' AND tablename = 'contract_invoices') THEN
    CREATE POLICY "contract_invoices_insert_auth" ON contract_invoices FOR INSERT WITH CHECK (
      is_admin() OR auth.role() = 'authenticated'
    );
  END IF;

  -- work_tasks INSERT for non-admin
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'work_tasks_insert_auth' AND tablename = 'work_tasks') THEN
    CREATE POLICY "work_tasks_insert_auth" ON work_tasks FOR INSERT WITH CHECK (
      is_admin() OR auth.role() = 'authenticated'
    );
  END IF;

  -- safety_incidents INSERT for non-admin
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'safety_incidents_insert_auth' AND tablename = 'safety_incidents') THEN
    CREATE POLICY "safety_incidents_insert_auth" ON safety_incidents FOR INSERT WITH CHECK (
      is_admin() OR auth.role() = 'authenticated'
    );
  END IF;
END $$;

-- 6. Verify all policies
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('approval_requests','approval_steps','contract_invoices','work_tasks','safety_incidents')
ORDER BY tablename, policyname;
