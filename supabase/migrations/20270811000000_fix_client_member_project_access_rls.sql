-- Migration: Fix Client & Client Member Project, Task, and Workflow Status Access RLS

-- 1. Projects SELECT Policy: Allow Admins, Managers, Project Members, and Clients/Client Members to view permitted projects
DROP POLICY IF EXISTS "Admin/Manager/Members can view projects" ON public.projects;
DROP POLICY IF EXISTS "Admin/Manager/Members/Clients can view projects" ON public.projects;

CREATE POLICY "Admin/Manager/Members/Clients can view projects"
ON public.projects FOR SELECT TO authenticated
USING (
  public.get_my_role() = ANY(ARRAY['admin', 'manager'])
  OR
  public.is_project_member(id)
  OR
  client_id IN (SELECT client_id FROM public.users WHERE id = auth.uid() AND client_id IS NOT NULL)
  OR
  public.get_my_role() = ANY(ARRAY['client', 'client member'])
);

-- 2. Tasks SELECT Policy: Allow Clients and Client Members to read client-visible tasks in their projects
DROP POLICY IF EXISTS "client_read_visible_tasks" ON public.tasks;

CREATE POLICY "client_read_visible_tasks"
ON public.tasks FOR SELECT TO authenticated
USING (
  public.get_my_role() = ANY(ARRAY['admin', 'manager'])
  OR
  assigned_to = auth.uid()
  OR
  (
    client_visible = true
    AND (
      public.is_project_member(project_id)
      OR
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = tasks.project_id
          AND p.client_id IN (SELECT client_id FROM public.users WHERE id = auth.uid() AND client_id IS NOT NULL)
      )
      OR
      public.get_my_role() = ANY(ARRAY['client', 'client member'])
    )
  )
);

-- 3. Workflow Statuses & Transitions: Allow authenticated users to view statuses and transitions for their project columns
DROP POLICY IF EXISTS "Authenticated can view workflow statuses" ON public.workflow_statuses;
CREATE POLICY "Authenticated can view workflow statuses"
ON public.workflow_statuses FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated can view workflow transitions" ON public.workflow_transitions;
CREATE POLICY "Authenticated can view workflow transitions"
ON public.workflow_transitions FOR SELECT TO authenticated
USING (true);
