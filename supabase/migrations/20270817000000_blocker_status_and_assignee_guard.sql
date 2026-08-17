-- Migration: 20270817000000_blocker_status_and_assignee_guard.sql
-- Enforces that tasks with active open blockers cannot have their status_id or assigned_to updated.

CREATE OR REPLACE FUNCTION public.check_task_blocker_before_update()
RETURNS TRIGGER AS $$
DECLARE
  v_open_blocker_count INT;
BEGIN
  -- Only validate if status_id or assigned_to is actually changing
  IF (OLD.status_id IS DISTINCT FROM NEW.status_id) OR (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    SELECT COUNT(*) INTO v_open_blocker_count
    FROM public.task_blockers
    WHERE task_id = NEW.id AND status = 'open';

    IF v_open_blocker_count > 0 THEN
      RAISE EXCEPTION 'Cannot update status or assignee of task "%": task has % active open blocker(s). Resolve all open blockers first.',
        OLD.title, v_open_blocker_count
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_blocked_task_status_assignee_change ON public.tasks;
CREATE TRIGGER trg_prevent_blocked_task_status_assignee_change
  BEFORE UPDATE OF status_id, assigned_to ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.check_task_blocker_before_update();
