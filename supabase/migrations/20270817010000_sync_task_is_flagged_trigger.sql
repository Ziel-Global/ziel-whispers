-- Migration: 20270817010000_sync_task_is_flagged_trigger.sql
-- Automatically syncs tasks.is_flagged in the database whenever task_blockers are created, updated, or deleted.

CREATE OR REPLACE FUNCTION public.sync_task_is_flagged_on_blocker_change()
RETURNS TRIGGER AS $$
DECLARE
  v_task_id UUID;
  v_open_count INT;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_task_id := OLD.task_id;
  ELSE
    v_task_id := NEW.task_id;
  END IF;

  IF v_task_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_open_count
    FROM public.task_blockers
    WHERE task_id = v_task_id AND status = 'open';

    UPDATE public.tasks
    SET is_flagged = (v_open_count > 0)
    WHERE id = v_task_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_task_is_flagged ON public.task_blockers;
CREATE TRIGGER trg_sync_task_is_flagged
  AFTER INSERT OR UPDATE OR DELETE ON public.task_blockers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_task_is_flagged_on_blocker_change();

-- Backfill: Instantly update all existing tasks in the database with their current open blocker status
UPDATE public.tasks
SET is_flagged = EXISTS (
  SELECT 1 FROM public.task_blockers
  WHERE task_blockers.task_id = tasks.id AND task_blockers.status = 'open'
);
