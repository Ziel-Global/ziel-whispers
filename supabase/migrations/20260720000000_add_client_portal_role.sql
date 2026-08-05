-- Add 'client portal' to role CHECK constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK ((role = ANY (ARRAY['admin'::text, 'manager'::text, 'employee'::text, 'client'::text, 'client member'::text, 'client portal'::text])));

-- Update client task SELECT policy to include 'client portal'
DROP POLICY IF EXISTS "client_read_visible_tasks" ON public.tasks;
CREATE POLICY "client_read_visible_tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('client', 'client member', 'client portal')
    AND client_visible = true
    AND EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = tasks.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.removed_at IS NULL
    )
  );
