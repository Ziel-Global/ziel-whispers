-- =======================================================================
-- Migration: 20270819000000_fix_record_task_status_history_trigger.sql
-- Description: Fixes the broken record_task_status_history() trigger
--   introduced by 20270815000002_automation_lockout_and_source_audit.sql.
--
-- Problems in the 20270815000002 version:
--   1. Used COALESCE(auth.role(), 'system') for changed_by_type.
--      auth.role() returns 'authenticated' or 'anon' — neither of which
--      is in the check constraint ('admin', 'system', 'auto'), causing a
--      constraint violation on every INSERT/UPDATE.
--   2. Used OLD.status_id in the IF condition without a TG_OP guard —
--      OLD is NULL on INSERT, causing a crash for every new task creation.
--   3. Only handled UPDATE (not INSERT), so new task creation was broken.
--
-- This migration replaces the trigger function with a correct version that:
--   - Handles both INSERT and UPDATE via TG_OP checks
--   - Reads changed_by_type from the app.task_changed_by_type session
--     variable (set by change_task_status RPC) and defaults to 'system'
--   - Correctly captures assigned_to_at_change and source
-- =======================================================================

CREATE OR REPLACE FUNCTION public.record_task_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed_by_type TEXT;
  v_assignee_at_change UUID;
  v_from_status_id UUID;
BEGIN
  -- On UPDATE: skip if status_id hasn't actually changed
  IF TG_OP = 'UPDATE' AND OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  -- Read the session variable set by change_task_status() RPC.
  -- Falls back to 'system' if not set or invalid.
  BEGIN
    v_changed_by_type := NULLIF(current_setting('app.task_changed_by_type', true), '');
  EXCEPTION WHEN OTHERS THEN
    v_changed_by_type := NULL;
  END;

  IF v_changed_by_type IS NULL OR v_changed_by_type NOT IN ('admin', 'system', 'auto') THEN
    v_changed_by_type := 'system';
  END IF;

  -- Capture previous assignee and from_status correctly per operation type
  IF TG_OP = 'UPDATE' THEN
    v_assignee_at_change := OLD.assigned_to;
    v_from_status_id     := OLD.status_id;
  ELSE
    -- INSERT: no previous state
    v_assignee_at_change := NEW.assigned_to;
    v_from_status_id     := NULL;
  END IF;

  INSERT INTO public.task_status_history (
    task_id,
    from_status_id,
    to_status_id,
    changed_by,
    changed_by_type,
    assigned_to_at_change,
    source
  )
  VALUES (
    NEW.id,
    v_from_status_id,
    NEW.status_id,
    auth.uid(),
    v_changed_by_type,
    v_assignee_at_change,
    CASE
      WHEN v_changed_by_type = 'auto'   THEN 'system'
      WHEN v_changed_by_type = 'system' THEN 'system'
      ELSE 'manual'
    END
  );

  RETURN NEW;
END;
$$;

-- Re-attach trigger (AFTER INSERT OR UPDATE) — replaces any previous version
DROP TRIGGER IF EXISTS trg_record_task_status_history ON public.tasks;
CREATE TRIGGER trg_record_task_status_history
  AFTER INSERT OR UPDATE OF status_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.record_task_status_history();
