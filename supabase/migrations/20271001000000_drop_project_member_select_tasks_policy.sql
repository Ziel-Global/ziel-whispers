-- Drop overly permissive tasks SELECT policy that ignored client_visible.
-- Client / client-member project members could read all project tasks,
-- including client_visible = false. Visibility must go through
-- client_read_visible_tasks (requires client_visible = true) or
-- assigned_user_select_tasks / admin_manager_all_tasks.
--
-- Safe to re-run: already applied manually on dev and production.

DROP POLICY IF EXISTS "project_member_select_tasks" ON public.tasks;
