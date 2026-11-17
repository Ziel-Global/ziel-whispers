-- Migration: Automatically sync tasks.completed_at when status moves to/from 'done'
-- Also backfills completed_at for existing tasks currently in 'done' status.

CREATE OR REPLACE FUNCTION public.sync_task_completed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cat TEXT;
BEGIN
  IF NEW.status_id IS NOT NULL THEN
    SELECT category INTO v_cat FROM public.workflow_statuses WHERE id = NEW.status_id;
    IF v_cat = 'done' THEN
      IF NEW.completed_at IS NULL THEN
        NEW.completed_at := NOW();
      END IF;
    ELSE
      NEW.completed_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_task_completed_at ON public.tasks;
CREATE TRIGGER trg_sync_task_completed_at
  BEFORE INSERT OR UPDATE OF status_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_task_completed_at();

-- Backfill existing tasks currently in 'done' status
UPDATE public.tasks t
SET completed_at = COALESCE(
  (
    SELECT tsh.changed_at
    FROM public.task_status_history tsh
    JOIN public.workflow_statuses ws ON ws.id = tsh.to_status_id
    WHERE tsh.task_id = t.id AND ws.category = 'done'
    ORDER BY tsh.changed_at DESC
    LIMIT 1
  ),
  t.created_at
)
WHERE t.completed_at IS NULL
  AND t.status_id IN (
    SELECT id FROM public.workflow_statuses WHERE category = 'done'
  );
