-- =======================================================================
-- Migration: 20270819000001_fix_trigger_null_status_guard.sql
-- Description: Adds a null status_id guard to record_task_status_history().
--
-- Root cause of "null value in column to_status_id violates not-null
-- constraint":
--   The trigger fires on ALL INSERTs into tasks (including those where
--   status_id is NULL — e.g. tasks created for projects with no workflow
--   template assigned, or bulk CSV rows without a status column).
--   NEW.status_id is then NULL and gets passed as to_status_id, which
--   has a NOT NULL constraint.
--
-- Fix: Return early (no history row) if NEW.status_id IS NULL.
--   A history entry is only meaningful when there is an actual status
--   to record; tasks without a workflow status simply skip the audit log.
-- =======================================================================

CREATE OR REPLACE FUNCTION public.record_task_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed_by_type    TEXT;
  v_assignee_at_change UUID;
  v_from_status_id     UUID;
BEGIN
  -- No status assigned — nothing to record
  IF NEW.status_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- On UPDATE: skip if status_id hasn't actually changed
  IF TG_OP = 'UPDATE' AND OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  -- Read the session variable set by change_task_status() RPC.
  -- Falls back to 'system' if not set or not a valid value.
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
      WHEN v_changed_by_type IN ('auto', 'system') THEN 'system'
      ELSE 'manual'
    END
  );

  RETURN NEW;
END;
$$;

-- Re-attach trigger — replaces the previous version
DROP TRIGGER IF EXISTS trg_record_task_status_history ON public.tasks;
CREATE TRIGGER trg_record_task_status_history
  AFTER INSERT OR UPDATE OF status_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.record_task_status_history();
