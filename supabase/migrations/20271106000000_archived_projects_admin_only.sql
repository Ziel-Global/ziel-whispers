-- Archived projects (and their tasks) are visible to admin only.
-- RESTRICTIVE policies AND with every existing SELECT policy, so all roles other than admin
-- (manager, project_manager, employee, client, client member) lose access the moment a project
-- is archived, and get it back as soon as it is set to any other status. Safe to re-run.

CREATE OR REPLACE FUNCTION public.is_project_archived(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM projects WHERE id = p_id AND status = 'archived');
$$;

DROP POLICY IF EXISTS "archived_projects_admin_only" ON public.projects;
CREATE POLICY "archived_projects_admin_only"
ON public.projects AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.get_my_role() = 'admin' OR status IS DISTINCT FROM 'archived');

DROP POLICY IF EXISTS "archived_project_tasks_admin_only" ON public.tasks;
CREATE POLICY "archived_project_tasks_admin_only"
ON public.tasks AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.get_my_role() = 'admin' OR project_id IS NULL OR NOT public.is_project_archived(project_id));

-- Daily logs of archived projects: hidden (not deleted) for non-admins; visible again on restore.
DROP POLICY IF EXISTS "archived_project_logs_admin_only" ON public.daily_logs;
CREATE POLICY "archived_project_logs_admin_only"
ON public.daily_logs AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.get_my_role() = 'admin' OR project_id IS NULL OR NOT public.is_project_archived(project_id));
