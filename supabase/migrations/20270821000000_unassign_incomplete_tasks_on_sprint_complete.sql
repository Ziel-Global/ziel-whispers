-- Migration: 20270821000000_unassign_incomplete_tasks_on_sprint_complete.sql
-- Purpose: Automatically unassign incomplete tasks from a sprint when it is marked as completed.

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.unassign_incomplete_tasks_on_sprint_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only execute when the status is changed TO 'completed'
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    -- Set sprint_id to NULL for any task in this sprint that is not in a 'done' category
    UPDATE public.tasks t
    SET sprint_id = NULL
    FROM public.workflow_statuses ws
    WHERE t.sprint_id = NEW.id
      AND t.status_id = ws.id
      AND ws.category != 'done';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to the sprints table
DROP TRIGGER IF EXISTS trg_unassign_incomplete_tasks_on_sprint_complete ON public.sprints;
CREATE TRIGGER trg_unassign_incomplete_tasks_on_sprint_complete
  AFTER UPDATE OF status ON public.sprints
  FOR EACH ROW
  EXECUTE FUNCTION public.unassign_incomplete_tasks_on_sprint_complete();

-- 3. One-time backfill to clean up existing completed sprints
UPDATE public.tasks t
SET sprint_id = NULL
FROM public.sprints s, public.workflow_statuses ws
WHERE t.sprint_id = s.id
  AND s.status = 'completed'
  AND t.status_id = ws.id
  AND ws.category != 'done';
