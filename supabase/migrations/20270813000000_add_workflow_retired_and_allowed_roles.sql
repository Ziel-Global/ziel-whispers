-- Migration: 20270813000000_add_workflow_retired_and_allowed_roles.sql
-- Description: B2 Workflow Enhancements
--   B2-A: Add `retired` boolean flag to WORKFLOW_STATUSES
--   B2-B: Add `allowed_role_ids` UUID[] to WORKFLOW_TRANSITIONS
--         and enforce role-gating inside the transition validation trigger.
--
-- Backward Compatibility:
--   retired    DEFAULT FALSE  → all existing statuses remain active (zero behaviour change)
--   allowed_role_ids DEFAULT NULL  → all existing transitions remain unrestricted (zero behaviour change)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. B2-A: Add retired column to workflow_statuses
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.workflow_statuses
  ADD COLUMN IF NOT EXISTS retired BOOLEAN NOT NULL DEFAULT FALSE;

-- Index: speeds up queries that filter active (non-retired) statuses
CREATE INDEX IF NOT EXISTS idx_workflow_statuses_retired
  ON public.workflow_statuses (workflow_template_id, retired);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. B2-B: Add allowed_role_ids column to workflow_transitions
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.workflow_transitions
  ADD COLUMN IF NOT EXISTS allowed_role_ids UUID[] DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. B2-B: Update validate_task_status_transition trigger to enforce role-gating
--
--  Logic:
--    1. Existing transition-existence check runs first (unchanged).
--    2. After confirming the transition exists, fetch its allowed_role_ids.
--    3. If allowed_role_ids IS NULL or empty  → no role restriction, pass through.
--    4. If changed_by_type IN ('admin', 'system', 'auto')  → system/admin bypass.
--    5. If acting user has system role 'admin' or 'manager'  → bypass.
--    6. Otherwise check project_members for user's project_role_id;
--       if it is not in allowed_role_ids  → RAISE EXCEPTION.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_task_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workflow_template_id UUID;
  v_allowed_role_ids     UUID[];
  v_changed_by_type      TEXT;
  v_acting_user_role     TEXT;
  v_user_project_role_id UUID;
BEGIN
  -- Skip if status_id hasn't changed
  IF TG_OP = 'UPDATE' AND OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  -- Resolve the workflow template for this task's project
  SELECT p.workflow_template_id INTO v_workflow_template_id
  FROM public.projects p
  WHERE p.id = NEW.project_id;

  -- ── Transition existence check (original behaviour, unchanged) ──────────────
  IF TG_OP = 'UPDATE' AND OLD.status_id IS NOT NULL AND NEW.status_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.workflow_transitions
      WHERE workflow_template_id = v_workflow_template_id
        AND from_status_id = OLD.status_id
        AND to_status_id   = NEW.status_id
    ) THEN
      RAISE EXCEPTION 'Invalid task status transition: % -> % is not allowed in this workflow',
        OLD.status_id, NEW.status_id;
    END IF;
  END IF;

  -- ── B2-B: Role-gating check ─────────────────────────────────────────────────
  -- Only applies to UPDATE where we have an explicit from→to transition
  IF TG_OP = 'UPDATE' AND OLD.status_id IS NOT NULL AND NEW.status_id IS NOT NULL THEN

    -- Fetch allowed_role_ids for this specific transition
    SELECT wt.allowed_role_ids INTO v_allowed_role_ids
    FROM public.workflow_transitions wt
    WHERE wt.workflow_template_id = v_workflow_template_id
      AND wt.from_status_id = OLD.status_id
      AND wt.to_status_id   = NEW.status_id
    LIMIT 1;

    -- Only enforce when allowed_role_ids is non-null and non-empty
    IF v_allowed_role_ids IS NOT NULL AND array_length(v_allowed_role_ids, 1) > 0 THEN

      -- Read the changed_by_type session variable set by change_task_status()
      BEGIN
        v_changed_by_type := NULLIF(current_setting('app.task_changed_by_type', true), '');
      EXCEPTION WHEN OTHERS THEN
        v_changed_by_type := NULL;
      END;

      -- Bypass: system / automation / admin override actor types
      IF v_changed_by_type IN ('admin', 'system', 'auto') THEN
        -- allowed — fall through
        NULL;
      ELSE
        -- Check acting user's system role (admin/manager bypass role-gating)
        SELECT u.role INTO v_acting_user_role
        FROM public.users u
        WHERE u.id = auth.uid();

        IF v_acting_user_role IN ('admin', 'manager') THEN
          -- allowed — system admin bypass
          NULL;
        ELSE
          -- Resolve the user's project role for this task's project
          SELECT pm.project_role_id INTO v_user_project_role_id
          FROM public.project_members pm
          WHERE pm.user_id    = auth.uid()
            AND pm.project_id = NEW.project_id
            AND pm.removed_at IS NULL
          LIMIT 1;

          -- Reject if user has no project role or role not in allowed list
          IF v_user_project_role_id IS NULL
             OR NOT (v_user_project_role_id = ANY(v_allowed_role_ids))
          THEN
            RAISE EXCEPTION 'Access denied: Your project role is not authorised to make this workflow transition.';
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;
  -- ─────────────────────────────────────────────────────────────────────────────

  -- Dual-write: sync the status text column from the workflow status name
  IF NEW.status_id IS NOT NULL THEN
    SELECT name INTO NEW.status
    FROM public.workflow_statuses
    WHERE id = NEW.status_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-attach BEFORE trigger (replaces the previous definition)
DROP TRIGGER IF EXISTS trg_validate_task_status_transition ON public.tasks;
CREATE TRIGGER trg_validate_task_status_transition
  BEFORE INSERT OR UPDATE OF status_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_status_transition();
