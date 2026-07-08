-- RPC function for the frontend to change task status
-- Sets session variable for the trigger to pick up changed_by_type
-- so the trigger can record admin/auto changes properly

CREATE OR REPLACE FUNCTION public.change_task_status(
  p_task_id UUID,
  p_new_status_id UUID,
  p_changed_by_type TEXT DEFAULT 'system'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_changed_by_type NOT IN ('admin', 'system', 'auto') THEN
    p_changed_by_type := 'system';
  END IF;

  PERFORM set_config('app.task_changed_by_type', p_changed_by_type, true);

  UPDATE public.tasks
  SET status_id = p_new_status_id
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
END;
$$;
