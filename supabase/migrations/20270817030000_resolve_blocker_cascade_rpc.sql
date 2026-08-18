-- Migration: Add Security Definer RPC function resolve_blocker_cascade
-- Allows any project team member or action item assignee to resolve task_blockers and sync linked client_action_items and task flag status.

CREATE OR REPLACE FUNCTION public.resolve_blocker_cascade(
  p_blocker_id UUID,
  p_resolved_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_id UUID;
  v_project_id UUID;
  v_open_count INT;
  v_updated_action_items INT := 0;
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_resolved_by, auth.uid());

  -- 1. Fetch task_id and project_id for the blocker
  SELECT task_id, project_id INTO v_task_id, v_project_id
  FROM public.task_blockers
  WHERE id = p_blocker_id;

  IF v_task_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Blocker not found');
  END IF;

  -- 2. Update task_blockers status to resolved
  UPDATE public.task_blockers
  SET 
    status = 'resolved',
    resolved_at = NOW(),
    resolved_by = v_user_id
  WHERE id = p_blocker_id;

  -- 3. Update any linked client_action_items status to completed
  UPDATE public.client_action_items
  SET 
    status = 'completed',
    completed_at = NOW(),
    resolved_by = v_user_id
  WHERE blocker_id = p_blocker_id AND status != 'completed';
  
  GET DIAGNOSTICS v_updated_action_items = ROW_COUNT;

  -- 4. Check if any open blockers remain on the task
  SELECT COUNT(*) INTO v_open_count
  FROM public.task_blockers
  WHERE task_id = v_task_id AND status = 'open';

  -- 5. Update task.is_flagged accordingly
  UPDATE public.tasks
  SET is_flagged = (v_open_count > 0)
  WHERE id = v_task_id;

  RETURN jsonb_build_object(
    'success', true,
    'task_id', v_task_id,
    'project_id', v_project_id,
    'open_blockers_remaining', v_open_count,
    'action_items_completed', v_updated_action_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_blocker_cascade(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_blocker_cascade(UUID, UUID) TO anon;
