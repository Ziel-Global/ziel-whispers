-- Split trg_validate_task_status_transition: BEFORE handles validation + dual-write,
-- AFTER handles history insert (avoids FK violation when task row isn't committed yet)

DROP TRIGGER IF EXISTS trg_validate_task_status_transition ON public.tasks;

CREATE OR REPLACE FUNCTION public.validate_task_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workflow_template_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  SELECT p.workflow_template_id INTO v_workflow_template_id
  FROM public.projects p
  WHERE p.id = NEW.project_id;

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

  IF NEW.status_id IS NOT NULL THEN
    SELECT name INTO NEW.status
    FROM public.workflow_statuses
    WHERE id = NEW.status_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_task_status_transition
  BEFORE INSERT OR UPDATE OF status_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_status_transition();

CREATE OR REPLACE FUNCTION public.record_task_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_changed_by_type TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_changed_by_type := NULLIF(current_setting('app.task_changed_by_type', true), '');
  EXCEPTION WHEN OTHERS THEN
    v_changed_by_type := NULL;
  END;
  IF v_changed_by_type IS NULL OR v_changed_by_type NOT IN ('admin', 'system', 'auto') THEN
    v_changed_by_type := 'system';
  END IF;

  INSERT INTO public.task_status_history
    (task_id, from_status_id, to_status_id, changed_by_type, changed_by)
  VALUES (
    NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status_id ELSE NULL END,
    NEW.status_id,
    v_changed_by_type,
    auth.uid()
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_record_task_status_history
  AFTER INSERT OR UPDATE OF status_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.record_task_status_history();
