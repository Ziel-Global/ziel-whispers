-- Parent / subtask hierarchy + gate to block completing a parent while subtasks are open.
-- Safe to re-run. Existing tasks stay top-level (parent_id NULL, require_subtasks_done false).

-- 1) Columns
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS require_subtasks_done BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON public.tasks(parent_id);

-- 2) Same project + max depth 1
CREATE OR REPLACE FUNCTION public.validate_task_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent public.tasks%ROWTYPE;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Task cannot be its own parent';
  END IF;
  SELECT * INTO v_parent FROM public.tasks WHERE id = NEW.parent_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent task not found';
  END IF;
  IF v_parent.parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'Subtasks cannot have subtasks';
  END IF;
  IF v_parent.project_id IS DISTINCT FROM NEW.project_id THEN
    RAISE EXCEPTION 'Subtask must be in the same project as its parent';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_task_parent ON public.tasks;
CREATE TRIGGER trg_validate_task_parent
  BEFORE INSERT OR UPDATE OF parent_id, project_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_parent();

-- 3) Subtasks cannot set require_subtasks_done (parent-only flag)
CREATE OR REPLACE FUNCTION public.clear_subtask_require_flag()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    NEW.require_subtasks_done := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_subtask_require_flag ON public.tasks;
CREATE TRIGGER trg_clear_subtask_require_flag
  BEFORE INSERT OR UPDATE OF parent_id, require_subtasks_done ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.clear_subtask_require_flag();

-- 4) Block completing a parent when require_subtasks_done and open children exist
CREATE OR REPLACE FUNCTION public.block_parent_done_with_open_subtasks()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_cat TEXT;
  v_old_cat TEXT;
  v_open_children INT;
BEGIN
  IF NEW.status_id IS NOT DISTINCT FROM OLD.status_id THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NOT COALESCE(NEW.require_subtasks_done, false) THEN
    RETURN NEW;
  END IF;

  SELECT category INTO v_new_cat FROM public.workflow_statuses WHERE id = NEW.status_id;
  SELECT category INTO v_old_cat FROM public.workflow_statuses WHERE id = OLD.status_id;

  IF COALESCE(v_new_cat, '') = 'done' AND COALESCE(v_old_cat, '') IS DISTINCT FROM 'done' THEN
    SELECT COUNT(*) INTO v_open_children
    FROM public.tasks c
    LEFT JOIN public.workflow_statuses ws ON ws.id = c.status_id
    WHERE c.parent_id = NEW.id
      AND NOT (
        COALESCE(ws.category, '') = 'done'
        OR c.completed_at IS NOT NULL
      );
    IF v_open_children > 0 THEN
      RAISE EXCEPTION 'Cannot complete parent while % subtask(s) are still open', v_open_children;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_parent_done_with_open_subtasks ON public.tasks;
CREATE TRIGGER trg_block_parent_done_with_open_subtasks
  BEFORE UPDATE OF status_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.block_parent_done_with_open_subtasks();

-- 5) Same guard inside change_task_status RPC (all app paths)
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
DECLARE
  v_task public.tasks%ROWTYPE;
  v_new_cat TEXT;
  v_open_children INT;
BEGIN
  IF p_changed_by_type NOT IN ('admin', 'system', 'auto') THEN
    p_changed_by_type := 'system';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  SELECT category INTO v_new_cat
  FROM public.workflow_statuses WHERE id = p_new_status_id;

  IF v_task.parent_id IS NULL
     AND COALESCE(v_task.require_subtasks_done, false)
     AND COALESCE(v_new_cat, '') = 'done' THEN
    SELECT COUNT(*) INTO v_open_children
    FROM public.tasks c
    LEFT JOIN public.workflow_statuses ws ON ws.id = c.status_id
    WHERE c.parent_id = p_task_id
      AND NOT (
        COALESCE(ws.category, '') = 'done'
        OR c.completed_at IS NOT NULL
      );
    IF v_open_children > 0 THEN
      RAISE EXCEPTION 'Cannot complete parent while % subtask(s) are still open', v_open_children;
    END IF;
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
