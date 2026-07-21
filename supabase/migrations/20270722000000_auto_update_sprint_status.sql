-- Auto-update sprint status based on task completion status.
-- Uses workflow_statuses.category to determine "done" vs "in_progress".
CREATE OR REPLACE FUNCTION public.auto_update_sprint_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sprint_id UUID;
  v_current_status TEXT;
  v_total INT;
  v_done INT;
  v_in_progress_count INT;
BEGIN
  v_sprint_id := COALESCE(NEW.sprint_id, OLD.sprint_id);
  IF v_sprint_id IS NULL THEN RETURN NEW; END IF;

  SELECT status INTO v_current_status FROM public.sprints WHERE id = v_sprint_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE t.status = 'complete' OR ws.category = 'done'),
    COUNT(*) FILTER (WHERE t.status = 'in_progress' OR ws.category = 'in_progress')
  INTO v_total, v_done, v_in_progress_count
  FROM public.tasks t
  LEFT JOIN public.workflow_statuses ws ON ws.id = t.status_id
  WHERE t.sprint_id = v_sprint_id;

  IF v_current_status = 'planned' AND v_in_progress_count > 0 THEN
    UPDATE public.sprints SET status = 'active' WHERE id = v_sprint_id;
  ELSIF v_done = v_total AND v_total > 0 THEN
    UPDATE public.sprints SET status = 'completed' WHERE id = v_sprint_id;
  ELSIF v_current_status = 'completed' AND v_done < v_total THEN
    UPDATE public.sprints SET status = 'active' WHERE id = v_sprint_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_update_sprint_status ON public.tasks;
CREATE TRIGGER trg_auto_update_sprint_status
  AFTER INSERT OR UPDATE OF status, status_id
  ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_sprint_status();

-- Backfill existing sprints based on current task state
UPDATE public.sprints s
SET status = CASE
  WHEN (
    SELECT COUNT(*) FROM public.tasks t
    LEFT JOIN public.workflow_statuses ws ON ws.id = t.status_id
    WHERE t.sprint_id = s.id
  ) > 0 AND (
    SELECT COUNT(*) FROM public.tasks t
    LEFT JOIN public.workflow_statuses ws ON ws.id = t.status_id
    WHERE t.sprint_id = s.id AND (t.status = 'complete' OR ws.category = 'done')
  ) = (
    SELECT COUNT(*) FROM public.tasks t
    LEFT JOIN public.workflow_statuses ws ON ws.id = t.status_id
    WHERE t.sprint_id = s.id
  ) THEN 'completed'
  WHEN s.status IN ('planned', 'completed') AND (
    SELECT COUNT(*) FROM public.tasks t
    LEFT JOIN public.workflow_statuses ws ON ws.id = t.status_id
    WHERE t.sprint_id = s.id AND (t.status = 'in_progress' OR ws.category = 'in_progress')
  ) > 0 THEN 'active'
  ELSE s.status
END;
