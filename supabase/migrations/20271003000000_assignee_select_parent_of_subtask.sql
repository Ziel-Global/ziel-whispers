-- Allow employees assigned to a subtask to SELECT the parent task row
-- (needed for "Parent / Subtask" labels on log submit without breaking RLS).
-- Uses SECURITY DEFINER helper so the child check does not re-enter tasks RLS
-- (EXISTS on tasks inside a tasks policy causes infinite recursion).
-- Safe to re-run. Does not grant update/delete on parents.

CREATE OR REPLACE FUNCTION public.is_assigned_to_child_of(p_parent_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE parent_id = p_parent_id
      AND assigned_to = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "assignee_can_select_parent_of_own_subtask" ON public.tasks;

CREATE POLICY "assignee_can_select_parent_of_own_subtask"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    parent_id IS NULL
    AND public.is_assigned_to_child_of(id)
  );
