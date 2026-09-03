-- Create or replace fast user deletion RPC function for instant (~50ms) execution
CREATE OR REPLACE FUNCTION public.delete_user_complete(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Delete user-owned records
  DELETE FROM public.project_members WHERE user_id = target_user_id;
  DELETE FROM public.auto_clockout_acks WHERE user_id = target_user_id;
  DELETE FROM public.audit_logs WHERE actor_id = target_user_id OR target_id = target_user_id;
  DELETE FROM public.attendance WHERE user_id = target_user_id;
  DELETE FROM public.daily_logs WHERE user_id = target_user_id;
  DELETE FROM public.leave_requests WHERE user_id = target_user_id;
  DELETE FROM public.notifications WHERE user_id = target_user_id;
  DELETE FROM public.leave_balances WHERE user_id = target_user_id;
  DELETE FROM public.announcement_reads WHERE user_id = target_user_id;
  DELETE FROM public.announcements WHERE created_by = target_user_id;
  DELETE FROM public.time_entries WHERE user_id = target_user_id;
  DELETE FROM public.missed_logs WHERE user_id = target_user_id;
  DELETE FROM public.remote_work_requests WHERE user_id = target_user_id;

  -- 2. Nullify references to user
  UPDATE public.attendance SET edited_by = NULL WHERE edited_by = target_user_id;
  UPDATE public.leave_requests SET reviewed_by = NULL WHERE reviewed_by = target_user_id;
  UPDATE public.remote_work_requests SET reviewed_by = NULL WHERE reviewed_by = target_user_id;
  UPDATE public.clients SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.projects SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.users SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.system_settings SET updated_by = NULL WHERE updated_by = target_user_id;
  UPDATE public.tasks SET assigned_to = NULL WHERE assigned_to = target_user_id;
  UPDATE public.tasks SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.task_comments SET author_id = NULL WHERE author_id = target_user_id;
  UPDATE public.task_blockers SET raised_by = NULL WHERE raised_by = target_user_id;
  UPDATE public.task_blockers SET resolved_by = NULL WHERE resolved_by = target_user_id;
  UPDATE public.task_status_history SET changed_by = NULL WHERE changed_by = target_user_id;
  UPDATE public.task_dependencies SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.project_status_updates SET author_id = NULL WHERE author_id = target_user_id;
  UPDATE public.goals SET created_by = NULL WHERE created_by = target_user_id;
  UPDATE public.goal_resources SET user_id = NULL WHERE user_id = target_user_id;
  UPDATE public.workflow_templates SET created_by = NULL WHERE created_by = target_user_id;

  -- 3. Delete user row from users table
  DELETE FROM public.users WHERE id = target_user_id;

  -- 4. Delete user from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN TRUE;
END;
$$;
