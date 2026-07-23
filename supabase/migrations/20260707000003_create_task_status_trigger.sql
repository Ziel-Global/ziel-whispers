-- Create trigger to validate task status transitions and record history
-- This trigger enforces the workflow_transitions rules at the database level
-- and automatically syncs the status text column (dual-write compatibility)

CREATE OR REPLACE FUNCTION public.validate_task_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workflow_template_id UUID;
  v_changed_by_type TEXT;
BEGIN
  -- For UPDATE: skip if status_id hasn't changed
  IF TG_OP = 'UPDATE' AND OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  -- Get the workflow template for this task's project
  SELECT p.workflow_template_id INTO v_workflow_template_id
  FROM public.projects p
  WHERE p.id = NEW.project_id;

  -- For UPDATE: validate transition from old status to new status
  -- (INSERT and NULL-to-X transitions are always allowed)
  IF TG_OP = 'UPDATE' AND OLD.status_id IS NOT NULL AND NEW.status_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.workflow_transitions
      WHERE workflow_template_id = v_workflow_template_id
        AND from_status_id = OLD.status_id
        AND to_status_id = NEW.status_id
    ) THEN
      RAISE EXCEPTION 'Invalid task status transition: % -> % is not allowed in this workflow',
        OLD.status_id, NEW.status_id;
    END IF;
  END IF;

  -- Determine changed_by_type from session variable (if set by the application)
  BEGIN
    v_changed_by_type := NULLIF(current_setting('app.task_changed_by_type', true), '');
  EXCEPTION WHEN OTHERS THEN
    v_changed_by_type := NULL;
  END;
  IF v_changed_by_type IS NULL OR v_changed_by_type NOT IN ('admin', 'system', 'auto') THEN
    v_changed_by_type := 'system';
  END IF;

  -- Record history entry
  INSERT INTO public.task_status_history
    (task_id, from_status_id, to_status_id, changed_by_type, changed_by)
  VALUES (
    NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status_id ELSE NULL END,
    NEW.status_id,
    v_changed_by_type,
    auth.uid()
  );

  -- Dual-write: sync the status text column from the workflow status name
  IF NEW.status_id IS NOT NULL THEN
    SELECT name INTO NEW.status
    FROM public.workflow_statuses
    WHERE id = NEW.status_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_task_status_transition ON public.tasks;
CREATE TRIGGER trg_validate_task_status_transition
  BEFORE INSERT OR UPDATE OF status_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_status_transition();
