
-- Add notes column to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes text;

-- Allow employees to view their own project's client (for project detail)
CREATE POLICY "Employees can view clients of their projects"
ON public.clients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM project_members pm
    JOIN projects p ON p.id = pm.project_id
    WHERE p.client_id = clients.id
    AND pm.user_id = auth.uid()
    AND pm.removed_at IS NULL
  )
);
