-- Add SELECT policy so clients can read client-visible tasks in their projects
-- Does not affect admin/manager/employee access

DROP POLICY IF EXISTS "client_read_visible_tasks" ON public.tasks;
CREATE POLICY "client_read_visible_tasks" ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('client', 'client member')
    AND client_visible = true
    AND EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = tasks.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.removed_at IS NULL
    )
  );
