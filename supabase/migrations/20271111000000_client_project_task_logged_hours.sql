-- Client portal "Delivery burndown": per-task logged-hour totals for one project.
-- Clients cannot read daily_logs (RLS), so this read-only function returns ONLY
-- task_id + summed hours — no user, notes, dates or other projects.
-- Same filter as the admin chart (project_id = p, status = 'submitted').
-- Adds a new function only: no table, policy or existing function is changed. Safe to re-run.

CREATE OR REPLACE FUNCTION public.get_project_task_logged_hours(p_project_id uuid)
RETURNS TABLE (task_id uuid, hours numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dl.task_id, SUM(dl.hours)::numeric AS hours
  FROM daily_logs dl
  WHERE dl.project_id = p_project_id
    AND dl.status = 'submitted'
    AND dl.task_id IS NOT NULL
    -- caller must be admin/manager or an active member of this project
    AND (
      public.get_my_role() = ANY (ARRAY['admin', 'project_manager', 'hr_manager', 'manager'])
      OR public.is_project_member(p_project_id)
    )
    -- archived projects stay admin-only (matches archived_project_logs_admin_only)
    AND (public.get_my_role() = 'admin' OR NOT public.is_project_archived(p_project_id))
  GROUP BY dl.task_id;
$$;

REVOKE ALL ON FUNCTION public.get_project_task_logged_hours(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_task_logged_hours(uuid) TO authenticated;
