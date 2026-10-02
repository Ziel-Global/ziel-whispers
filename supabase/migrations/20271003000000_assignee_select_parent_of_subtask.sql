-- Allow employees assigned to a subtask to SELECT the parent task row
-- (needed for "Parent / Subtask" labels on log submit without breaking RLS).
-- Safe to re-run. Does not grant update/delete on parents.

DROP POLICY IF EXISTS "assignee_can_select_parent_of_own_subtask" ON public.tasks;

CREATE POLICY "assignee_can_select_parent_of_own_subtask"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    parent_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.tasks c
      WHERE c.parent_id = tasks.id
        AND c.assigned_to = auth.uid()
    )
  );
