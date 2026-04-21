-- Fix the broken employee project visibility RLS policy
DROP POLICY IF EXISTS "Admin/Manager can view all projects" ON public.projects;

CREATE POLICY "Admin/Manager can view all projects"
ON public.projects
FOR SELECT
USING (
  (get_my_role() = ANY (ARRAY['admin'::text, 'manager'::text]))
  OR
  (EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = projects.id
      AND pm.user_id = auth.uid()
      AND pm.removed_at IS NULL
  ))
);