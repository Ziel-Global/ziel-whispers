-- ============================================================================
-- Migration: 20271109020000_remove_manager_role_and_fix_pm_hr_rls.sql
-- Description:
--   1. Migrate all existing `role = 'manager'` users to `role = 'project_manager'`.
--   2. Remove `'manager'` from `public.users` role CHECK constraint.
--      Allowed roles are now: 'admin', 'project_manager', 'hr_manager', 'employee', 'client', 'client member'.
--   3. Update RLS policies across all project, workflow, people/HR, and collaboration
--      tables so `project_manager` and `hr_manager` have their proper database access.
--   4. Update helper & trigger functions (`get_admin_manager_ids`, `validate_task_status_transition`,
--      `run_automation_rules`, `create_default_project_settings`) to use `project_manager` / `hr_manager`.
-- ============================================================================

-- Ensure client_id column exists on public.users (referenced in client RLS policies)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- 1. Migrate existing 'manager' users to 'project_manager'
UPDATE public.users
SET role = 'project_manager'
WHERE role = 'manager';

-- 2. Update users_role_check constraint (remove 'manager')
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK ((role = ANY (ARRAY[
    'admin'::text,
    'project_manager'::text,
    'hr_manager'::text,
    'employee'::text,
    'client'::text,
    'client member'::text
  ])));

-- 3. Update helper functions
CREATE OR REPLACE FUNCTION public.get_admin_manager_ids()
RETURNS TABLE (id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT u.id FROM public.users u
  WHERE u.role = 'admin'
    AND u.status = 'active'
    AND (u.tenant_id = public.user_tenant_id() OR public.user_tenant_id() IS NULL);
$$;

CREATE OR REPLACE FUNCTION public.get_project_notification_admin_ids(p_project_id UUID)
RETURNS TABLE (id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT u.id FROM public.users u
  WHERE u.status = 'active'
    AND (u.tenant_id = public.user_tenant_id() OR public.user_tenant_id() IS NULL)
    AND (
      u.role = 'admin'
      OR (
        u.role = 'project_manager'
        AND EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = p_project_id
            AND pm.user_id = u.id
            AND pm.removed_at IS NULL
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.get_hr_admin_ids()
RETURNS TABLE (id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT u.id FROM public.users u
  WHERE u.role IN ('admin', 'hr_manager')
    AND u.status = 'active'
    AND (u.tenant_id = public.user_tenant_id() OR public.user_tenant_id() IS NULL);
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_manager_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_notification_admin_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hr_admin_ids() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_default_project_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_settings (project_id, tenant_id)
  VALUES (NEW.id, NEW.tenant_id)
  ON CONFLICT (project_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. USERS & PEOPLE / HR TABLES
-- ============================================================================

-- users: admin, project_manager, hr_manager can view all users in their tenant
DROP POLICY IF EXISTS "Admin/Manager can view all users; employee own" ON public.users;
DROP POLICY IF EXISTS "Admin/Manager can view all users" ON public.users;
CREATE POLICY "Admin/Manager can view all users; employee own"
ON public.users FOR SELECT TO authenticated
USING (
  public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text, 'hr_manager'::text])
  OR id = auth.uid()
);

-- attendance: allow admin and hr_manager full management; employees manage own
DROP POLICY IF EXISTS "Admin/HR can manage all attendance" ON public.attendance;
CREATE POLICY "Admin/HR can manage all attendance"
ON public.attendance FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text]));

-- leave_requests: admin and hr_manager full access; project_manager can read; users manage own
DROP POLICY IF EXISTS "Admin full access on leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_insert_policy" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_select_policy" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_update_policy" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_delete_policy" ON public.leave_requests;

CREATE POLICY "leave_requests_select_policy"
ON public.leave_requests FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text, 'project_manager'::text])
);

CREATE POLICY "leave_requests_insert_policy"
ON public.leave_requests FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text])
);

CREATE POLICY "leave_requests_update_policy"
ON public.leave_requests FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text])
)
WITH CHECK (
  auth.uid() = user_id
  OR public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text])
);

CREATE POLICY "leave_requests_delete_policy"
ON public.leave_requests FOR DELETE TO authenticated
USING (
  (auth.uid() = user_id AND status IN ('pending', 'cancelled'))
  OR public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text])
);

-- remote_work_requests: ensure admin & hr_manager can manage, project_manager can read, users manage own
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'remote_work_requests') THEN
    DROP POLICY IF EXISTS "Admin/HR full access on remote_work_requests" ON public.remote_work_requests;
    CREATE POLICY "Admin/HR full access on remote_work_requests"
      ON public.remote_work_requests FOR ALL TO authenticated
      USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text]))
      WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text]));

    DROP POLICY IF EXISTS "PM can view remote_work_requests" ON public.remote_work_requests;
    CREATE POLICY "PM can view remote_work_requests"
      ON public.remote_work_requests FOR SELECT TO authenticated
      USING (public.get_my_role() = 'project_manager');
  END IF;
END $$;

-- leave_balances: admin and hr_manager can manage; all authenticated can view own / managers view
DROP POLICY IF EXISTS "Admin can insert leave balances" ON public.leave_balances;
CREATE POLICY "Admin can insert leave balances"
ON public.leave_balances FOR INSERT TO authenticated
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text]));

DROP POLICY IF EXISTS "Admin can update leave balances" ON public.leave_balances;
CREATE POLICY "Admin can update leave balances"
ON public.leave_balances FOR UPDATE TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text]));

DROP POLICY IF EXISTS "Admin can delete leave balances" ON public.leave_balances;
CREATE POLICY "Admin can delete leave balances"
ON public.leave_balances FOR DELETE TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text]));

DROP POLICY IF EXISTS "Admin/HR/PM can view all leave balances" ON public.leave_balances;
CREATE POLICY "Admin/HR/PM can view all leave balances"
ON public.leave_balances FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text, 'project_manager'::text])
);

-- leave_types: admin and hr_manager can manage
DROP POLICY IF EXISTS "Admin can manage leave types" ON public.leave_types;
CREATE POLICY "Admin can manage leave types"
ON public.leave_types FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text]));

-- holidays: admin and hr_manager can manage
DROP POLICY IF EXISTS "Allow admins to manage holidays" ON public.holidays;
CREATE POLICY "Allow admins to manage holidays"
ON public.holidays FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text]));

-- daily_logs: admin, project_manager, hr_manager can view all logs; admin & project_manager can insert/update
DROP POLICY IF EXISTS "Admin/Managers can view all daily logs" ON public.daily_logs;
CREATE POLICY "Admin/Managers can view all daily logs"
ON public.daily_logs FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text, 'hr_manager'::text])
);

DROP POLICY IF EXISTS "Admin can update daily logs" ON public.daily_logs;
CREATE POLICY "Admin can update daily logs"
ON public.daily_logs FOR UPDATE TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text, 'hr_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text, 'hr_manager'::text]));

DROP POLICY IF EXISTS "Admins can insert daily logs" ON public.daily_logs;
CREATE POLICY "Admins can insert daily logs"
ON public.daily_logs FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text, 'hr_manager'::text])
);

-- daily_standups: admin, project_manager, hr_manager can view all
DROP POLICY IF EXISTS "Admins can manage daily standups" ON public.daily_standups;
CREATE POLICY "Admins can manage daily standups"
ON public.daily_standups FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text, 'hr_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text, 'hr_manager'::text]));

-- missed_logs: admin, project_manager, hr_manager can view/manage
DROP POLICY IF EXISTS "Admin can insert missed logs" ON public.missed_logs;
CREATE POLICY "Admin can insert missed logs"
ON public.missed_logs FOR ALL TO authenticated
USING (
  user_id = auth.uid()
  OR public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text, 'hr_manager'::text])
)
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text, 'hr_manager'::text]));

-- announcements: admin and hr_manager can manage; all authenticated can view
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'announcements') THEN
    DROP POLICY IF EXISTS "Admin/HR can manage announcements" ON public.announcements;
    CREATE POLICY "Admin/HR can manage announcements"
      ON public.announcements FOR ALL TO authenticated
      USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text]))
      WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'hr_manager'::text]));
  END IF;
END $$;

-- ============================================================================
-- 5. PROJECTS, CLIENTS, PHASES, SPRINTS, TASKS & WORKFLOWS
--    (admin + project_manager have full CRUD across all workspace projects)
-- ============================================================================

-- clients
DROP POLICY IF EXISTS "Admin/Manager/Members can view clients" ON public.clients;
CREATE POLICY "Admin/Manager/Members can view clients"
ON public.clients FOR SELECT TO authenticated
USING (
  public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text, 'hr_manager'::text])
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.client_id = clients.id AND public.is_project_member(p.id)
  )
  OR id IN (SELECT client_id FROM public.users WHERE id = auth.uid() AND client_id IS NOT NULL)
);

DROP POLICY IF EXISTS "Admin/PM can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Admin/Manager can delete clients" ON public.clients;
CREATE POLICY "Admin/PM can manage clients"
ON public.clients FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

-- projects
DROP POLICY IF EXISTS "Admin/Manager can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Admin/Manager/Members can view projects" ON public.projects;
DROP POLICY IF EXISTS "Admin/Manager/Members/Clients can view projects" ON public.projects;
CREATE POLICY "Admin/Manager/Members/Clients can view projects"
ON public.projects FOR SELECT TO authenticated
USING (
  public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text, 'hr_manager'::text])
  OR (
    public.get_my_role() NOT IN ('client', 'client member')
    AND (
      public.is_project_member(id)
      OR client_id IN (SELECT client_id FROM public.users WHERE id = auth.uid() AND client_id IS NOT NULL)
    )
  )
  OR (
    public.get_my_role() = ANY (ARRAY['client'::text, 'client member'::text])
    AND status IS DISTINCT FROM 'archived'
    AND (
      public.is_project_member(id)
      OR client_id IN (SELECT client_id FROM public.users WHERE id = auth.uid() AND client_id IS NOT NULL)
    )
  )
);

DROP POLICY IF EXISTS "Admin/PM can manage projects" ON public.projects;
DROP POLICY IF EXISTS "Admin/Manager can delete projects" ON public.projects;
CREATE POLICY "Admin/PM can manage projects"
ON public.projects FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

-- project_settings
DROP POLICY IF EXISTS "project_settings_select" ON public.project_settings;
CREATE POLICY "project_settings_select"
ON public.project_settings FOR SELECT TO authenticated
USING (
  public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text])
  OR public.is_project_member(project_id)
);

DROP POLICY IF EXISTS "project_settings_insert" ON public.project_settings;
CREATE POLICY "project_settings_insert"
ON public.project_settings FOR INSERT TO authenticated
WITH CHECK (
  public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text])
  OR public.is_project_member(project_id)
);

DROP POLICY IF EXISTS "project_settings_update" ON public.project_settings;
CREATE POLICY "project_settings_update"
ON public.project_settings FOR UPDATE TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

-- project_settings_kv
DROP POLICY IF EXISTS "project_settings_kv_admin_manage" ON public.project_settings_kv;
CREATE POLICY "project_settings_kv_admin_manage"
ON public.project_settings_kv FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

-- project_roles
DROP POLICY IF EXISTS "Admin/Manager can manage project roles" ON public.project_roles;
CREATE POLICY "Admin/Manager can manage project roles"
ON public.project_roles FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

-- project_members
DROP POLICY IF EXISTS "Members can view all members of their projects" ON public.project_members;
CREATE POLICY "Members can view all members of their projects"
ON public.project_members FOR SELECT TO authenticated
USING (
  public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text, 'hr_manager'::text])
  OR public.is_project_member(project_id)
);

DROP POLICY IF EXISTS "Admin/Manager can manage project members" ON public.project_members;
CREATE POLICY "Admin/Manager can manage project members"
ON public.project_members FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

-- project_phases
DROP POLICY IF EXISTS admin_manager_all_project_phases ON public.project_phases;
CREATE POLICY admin_manager_all_project_phases
ON public.project_phases FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

DROP POLICY IF EXISTS "Members view phases on assigned projects" ON public.project_phases;
CREATE POLICY "Members view phases on assigned projects"
ON public.project_phases FOR SELECT TO authenticated
USING (
  public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text, 'hr_manager'::text])
  OR public.is_project_member(project_id)
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_phases.project_id
      AND p.client_id IN (SELECT client_id FROM public.users WHERE id = auth.uid() AND client_id IS NOT NULL)
  )
);

-- sprints
DROP POLICY IF EXISTS "Admin full access on sprints" ON public.sprints;
CREATE POLICY "Admin full access on sprints"
ON public.sprints FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

DROP POLICY IF EXISTS "Employees view sprints on assigned projects" ON public.sprints;
CREATE POLICY "Employees view sprints on assigned projects"
ON public.sprints FOR SELECT TO authenticated
USING (
  public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text, 'hr_manager'::text])
  OR public.is_project_member(project_id)
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = sprints.project_id
      AND p.client_id IN (SELECT client_id FROM public.users WHERE id = auth.uid() AND client_id IS NOT NULL)
  )
);

-- project_health_snapshots
DO $$
BEGIN
  IF to_regclass('public.project_health_snapshots') IS NOT NULL THEN
    DROP POLICY IF EXISTS "admin_all_health_snapshots" ON public.project_health_snapshots;
    CREATE POLICY "admin_all_health_snapshots"
      ON public.project_health_snapshots FOR ALL TO authenticated
      USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
      WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));
  END IF;
END $$;

-- project_status_updates
DROP POLICY IF EXISTS "admin_all_status_updates" ON public.project_status_updates;
CREATE POLICY "admin_all_status_updates"
ON public.project_status_updates FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

-- workflow_templates, workflow_statuses, workflow_transitions (CRUD for admin & project_manager)
DROP POLICY IF EXISTS "admin_manager_all_workflow_templates" ON public.workflow_templates;
CREATE POLICY "admin_manager_all_workflow_templates"
ON public.workflow_templates FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

DROP POLICY IF EXISTS "admin_manager_all_workflow_statuses" ON public.workflow_statuses;
CREATE POLICY "admin_manager_all_workflow_statuses"
ON public.workflow_statuses FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

DROP POLICY IF EXISTS "admin_manager_all_workflow_transitions" ON public.workflow_transitions;
CREATE POLICY "admin_manager_all_workflow_transitions"
ON public.workflow_transitions FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

-- task_types
DROP POLICY IF EXISTS "task_types_admin_manage" ON public.task_types;
CREATE POLICY "task_types_admin_manage"
ON public.task_types FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

-- tasks
DROP POLICY IF EXISTS "admin_manager_all_tasks" ON public.tasks;
CREATE POLICY "admin_manager_all_tasks"
ON public.tasks FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

DROP POLICY IF EXISTS "client_read_visible_tasks" ON public.tasks;
CREATE POLICY "client_read_visible_tasks"
ON public.tasks FOR SELECT TO authenticated
USING (
  public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text, 'hr_manager'::text])
  OR assigned_to = auth.uid()
  OR (
    public.get_my_role() = 'employee'
    AND public.is_project_member(project_id)
  )
  OR (
    client_visible = true
    AND (
      public.is_project_member(project_id)
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = tasks.project_id
          AND p.client_id IN (SELECT client_id FROM public.users WHERE id = auth.uid() AND client_id IS NOT NULL)
      )
      OR public.get_my_role() = ANY (ARRAY['client'::text, 'client member'::text])
    )
  )
);

-- task_collaborators
DROP POLICY IF EXISTS "admin_manager_all_task_collaborators" ON public.task_collaborators;
CREATE POLICY "admin_manager_all_task_collaborators"
ON public.task_collaborators FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

-- task_comments
DROP POLICY IF EXISTS "admin_manager_all_task_comments" ON public.task_comments;
CREATE POLICY "admin_manager_all_task_comments"
ON public.task_comments FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

-- task_blockers
DROP POLICY IF EXISTS "admin_manager_all_task_blockers" ON public.task_blockers;
CREATE POLICY "admin_manager_all_task_blockers"
ON public.task_blockers FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

DROP POLICY IF EXISTS "user_update_task_blockers" ON public.task_blockers;
CREATE POLICY "user_update_task_blockers"
ON public.task_blockers FOR UPDATE TO authenticated
USING (
  raised_by = auth.uid()
  OR public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text])
);

-- task_dependencies
DROP POLICY IF EXISTS "admin_all_task_dependencies" ON public.task_dependencies;
CREATE POLICY "admin_all_task_dependencies"
ON public.task_dependencies FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

-- task_schedule_snapshots
DO $$
BEGIN
  IF to_regclass('public.task_schedule_snapshots') IS NOT NULL THEN
    DROP POLICY IF EXISTS "admin_all_task_schedule_snapshots" ON public.task_schedule_snapshots;
    CREATE POLICY "admin_all_task_schedule_snapshots"
      ON public.task_schedule_snapshots FOR ALL TO authenticated
      USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
      WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));
  END IF;
END $$;

-- task_status_history
DROP POLICY IF EXISTS "admin_manager_all_task_status_history" ON public.task_status_history;
CREATE POLICY "admin_manager_all_task_status_history"
ON public.task_status_history FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

-- automation_rules & automation_rule_runs
DROP POLICY IF EXISTS "admin_all_automation_rules" ON public.automation_rules;
CREATE POLICY "admin_all_automation_rules"
ON public.automation_rules FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

DROP POLICY IF EXISTS "admin_all_automation_rule_runs" ON public.automation_rule_runs;
CREATE POLICY "admin_all_automation_rule_runs"
ON public.automation_rule_runs FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

-- client_action_items, client_action_item_messages, client_portal_messages
DROP POLICY IF EXISTS "admin_all_action_items" ON public.client_action_items;
CREATE POLICY "admin_all_action_items"
ON public.client_action_items FOR ALL TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

DROP POLICY IF EXISTS "admin_select_action_item_messages" ON public.client_action_item_messages;
CREATE POLICY "admin_select_action_item_messages"
ON public.client_action_item_messages FOR SELECT TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));

DO $$
BEGIN
  IF to_regclass('public.client_portal_messages') IS NOT NULL THEN
    DROP POLICY IF EXISTS "admin_all_portal_messages" ON public.client_portal_messages;
    CREATE POLICY "admin_all_portal_messages"
      ON public.client_portal_messages FOR ALL TO authenticated
      USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]))
      WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text]));
  END IF;
END $$;

-- ============================================================================
-- 6. UPDATE WORKFLOW TRANSITION & AUTOMATION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_task_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workflow_template_id UUID;
  v_allowed_role_ids     UUID[];
  v_changed_by_type      TEXT;
  v_acting_user_role     TEXT;
  v_user_project_role_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  SELECT p.workflow_template_id INTO v_workflow_template_id
  FROM public.projects p
  WHERE p.id = NEW.project_id;

  IF TG_OP = 'UPDATE' AND OLD.status_id IS NOT NULL AND NEW.status_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.workflow_transitions
      WHERE workflow_template_id = v_workflow_template_id
        AND from_status_id = OLD.status_id
        AND to_status_id   = NEW.status_id
    ) THEN
      RAISE EXCEPTION 'Invalid task status transition: % -> % is not allowed in this workflow',
        OLD.status_id, NEW.status_id;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status_id IS NOT NULL AND NEW.status_id IS NOT NULL THEN
    SELECT wt.allowed_role_ids INTO v_allowed_role_ids
    FROM public.workflow_transitions wt
    WHERE wt.workflow_template_id = v_workflow_template_id
      AND wt.from_status_id = OLD.status_id
      AND wt.to_status_id   = NEW.status_id
    LIMIT 1;

    IF v_allowed_role_ids IS NOT NULL AND array_length(v_allowed_role_ids, 1) > 0 THEN
      BEGIN
        v_changed_by_type := NULLIF(current_setting('app.task_changed_by_type', true), '');
      EXCEPTION WHEN OTHERS THEN
        v_changed_by_type := NULL;
      END;

      IF v_changed_by_type IN ('admin', 'system', 'auto') THEN
        NULL;
      ELSE
        SELECT u.role INTO v_acting_user_role
        FROM public.users u
        WHERE u.id = auth.uid();

        IF v_acting_user_role IN ('admin', 'project_manager') THEN
          NULL;
        ELSE
          SELECT pm.project_role_id INTO v_user_project_role_id
          FROM public.project_members pm
          WHERE pm.user_id    = auth.uid()
            AND pm.project_id = NEW.project_id
            AND pm.removed_at IS NULL
          LIMIT 1;

          IF v_user_project_role_id IS NULL
             OR NOT (v_user_project_role_id = ANY(v_allowed_role_ids))
          THEN
            RAISE EXCEPTION 'Access denied: Your project role is not authorised to make this workflow transition.';
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  IF NEW.status_id IS NOT NULL THEN
    SELECT name INTO NEW.status
    FROM public.workflow_statuses
    WHERE id = NEW.status_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_automation_rules(
  p_project_id UUID,
  p_trigger_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_root_event_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_condition JSONB;
  v_condition_passed BOOLEAN;
  v_action JSONB;
  v_action_result TEXT;
  v_error_msg TEXT;
  v_actual_root_id UUID;
  v_chain_depth INTEGER;
  v_target_status_id UUID;
  v_target_user_id UUID;
  v_target_role_id UUID;
  v_fallback_role_id UUID;
  v_previous_owner UUID;
  v_role_holder RECORD;
  v_task_id UUID;
  v_task_record RECORD;
  v_field TEXT;
  v_operator TEXT;
  v_value TEXT;
  v_current_value TEXT;
  v_current_status_name TEXT;
  v_lookup_by TEXT;
  v_recipient TEXT;
  v_notify_user_id UUID;
  v_notification_type TEXT;
  v_notify_title TEXT;
  v_message_template TEXT;
  v_resolved_message TEXT;
  v_project_name TEXT;
  v_task_title TEXT;
  v_assignee_name TEXT;
  v_project_tenant_id UUID;
  v_has_active_blockers BOOLEAN := false;
  v_is_task_flagged BOOLEAN := false;
BEGIN
  v_actual_root_id := COALESCE(p_root_event_id, gen_random_uuid());

  SELECT tenant_id INTO v_project_tenant_id FROM public.projects WHERE id = p_project_id;

  IF p_root_event_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER + 1 INTO v_chain_depth
    FROM automation_rule_runs
    WHERE root_event_id = p_root_event_id;
  ELSE
    v_chain_depth := 1;
  END IF;

  IF v_chain_depth > 5 THEN
    RETURN;
  END IF;

  v_task_id := CASE
    WHEN p_entity_type = 'task' THEN p_entity_id
    WHEN p_entity_type = 'blocker' THEN (SELECT task_id FROM task_blockers WHERE id = p_entity_id)
    ELSE NULL
  END;

  IF v_task_id IS NOT NULL THEN
    SELECT COALESCE(is_flagged, false) INTO v_is_task_flagged FROM tasks WHERE id = v_task_id;
    SELECT EXISTS (
      SELECT 1 FROM task_blockers 
      WHERE task_id = v_task_id AND resolved_at IS NULL AND (status IS NULL OR status = 'open')
    ) INTO v_has_active_blockers;
  END IF;

  FOR v_rule IN
    SELECT * FROM automation_rules
    WHERE project_id = p_project_id
      AND trigger_type = p_trigger_type
      AND status = 'enabled'
    ORDER BY priority DESC
  LOOP
    IF (v_is_task_flagged OR v_has_active_blockers) AND p_trigger_type = 'status_change' THEN
      INSERT INTO automation_rule_runs (
        automation_rule_id, entity_type, entity_id, root_event_id, result, error_message
      )
      VALUES (
        v_rule.id, p_entity_type, p_entity_id, v_actual_root_id, 'deferred_lockout',
        'Automation action deferred: Task is currently locked due to active unresolved blockers or flag lockout.'
      );
      CONTINUE;
    END IF;

    v_condition_passed := true;
    IF jsonb_array_length(v_rule.conditions) > 0 THEN
      SELECT * INTO v_task_record FROM tasks WHERE id = v_task_id;
      FOR v_condition IN SELECT * FROM jsonb_array_elements(v_rule.conditions)
      LOOP
        v_field := v_condition->>'field';
        v_operator := v_condition->>'operator';
        v_value := v_condition->>'value';

        IF v_operator = 'always' THEN
          CONTINUE;
        END IF;

        CASE v_field
          WHEN 'status_id' THEN 
            v_current_value := v_task_record.status_id::text;
            SELECT ws.name INTO v_current_status_name 
            FROM public.workflow_statuses ws WHERE ws.id = v_task_record.status_id;
          WHEN 'priority' THEN v_current_value := v_task_record.priority;
          WHEN 'assigned_to' THEN v_current_value := v_task_record.assigned_to::text;
          WHEN 'due_date' THEN v_current_value := v_task_record.due_date::text;
          WHEN 'description' THEN v_current_value := v_task_record.description;
          ELSE v_current_value := NULL;
        END CASE;

        CASE v_operator
          WHEN 'eq' THEN 
            IF v_field = 'status_id' THEN
              v_condition_passed := (v_current_value IS NOT DISTINCT FROM v_value) OR (v_current_status_name ILIKE v_value);
            ELSE
              v_condition_passed := (v_current_value IS NOT DISTINCT FROM v_value);
            END IF;
          WHEN 'neq' THEN 
            IF v_field = 'status_id' THEN
              v_condition_passed := (v_current_value IS DISTINCT FROM v_value) AND (v_current_status_name NOT ILIKE v_value);
            ELSE
              v_condition_passed := (v_current_value IS DISTINCT FROM v_value);
            END IF;
          WHEN 'contains' THEN 
            v_condition_passed := COALESCE(v_current_value, '') LIKE '%' || COALESCE(v_value, '') || '%' OR COALESCE(v_current_status_name, '') LIKE '%' || COALESCE(v_value, '') || '%';
          WHEN 'gt' THEN
            BEGIN
              v_condition_passed := v_current_value::timestamp > v_value::timestamp;
            EXCEPTION WHEN OTHERS THEN
              v_condition_passed := false;
            END;
          WHEN 'lt' THEN
            BEGIN
              v_condition_passed := v_current_value::timestamp < v_value::timestamp;
            EXCEPTION WHEN OTHERS THEN
              v_condition_passed := false;
            END;
          ELSE v_condition_passed := false;
        END CASE;

        IF NOT v_condition_passed THEN EXIT; END IF;
      END LOOP;
    END IF;

    IF NOT v_condition_passed THEN
      INSERT INTO automation_rule_runs (automation_rule_id, entity_type, entity_id, root_event_id, result)
      VALUES (v_rule.id, p_entity_type, p_entity_id, v_actual_root_id, 'condition_not_met');
      CONTINUE;
    END IF;

    FOR v_action IN SELECT * FROM jsonb_array_elements(v_rule.actions)
    LOOP
      v_error_msg := NULL;
      v_action_result := 'success';

      BEGIN
        CASE v_action->>'type'
          WHEN 'change_status' THEN
            v_target_status_id := (v_action->'params'->>'status_id')::UUID;
            IF v_target_status_id IS NOT NULL AND v_task_id IS NOT NULL THEN
              UPDATE tasks SET status_id = v_target_status_id WHERE id = v_task_id;
              
              INSERT INTO task_status_history (
                task_id, from_status_id, to_status_id, changed_by, changed_by_type, source, automation_rule_id
              )
              VALUES (
                v_task_id, v_task_record.status_id, v_target_status_id, auth.uid(), 'system', 'system', v_rule.id
              );
            END IF;

          WHEN 'assign_user' THEN
            v_target_user_id := (v_action->'params'->>'user_id')::UUID;
            IF v_target_user_id IS NOT NULL AND v_task_id IS NOT NULL THEN
              UPDATE tasks SET assigned_to = v_target_user_id WHERE id = v_task_id;
            END IF;

          WHEN 'assign_role' THEN
            v_target_role_id := (v_action->'params'->>'role_id')::UUID;
            IF v_target_role_id IS NOT NULL AND v_task_id IS NOT NULL THEN
              SELECT pm.user_id INTO v_role_holder
              FROM project_members pm
              WHERE pm.project_id = p_project_id
                AND pm.project_role_id = v_target_role_id
                AND pm.removed_at IS NULL
              ORDER BY (
                SELECT COUNT(*) FROM tasks t
                JOIN workflow_statuses ws ON ws.id = t.status_id
                WHERE t.assigned_to = pm.user_id AND ws.category != 'done'
              ) ASC
              LIMIT 1;
              IF v_role_holder.user_id IS NOT NULL THEN
                UPDATE tasks SET assigned_to = v_role_holder.user_id WHERE id = v_task_id;
              END IF;
            END IF;

          WHEN 'reassign_to_stage_owner' THEN
            v_target_status_id := (v_action->'params'->>'status_id')::UUID;
            v_fallback_role_id := (v_action->'params'->>'fallback_role_id')::UUID;
            v_lookup_by := COALESCE(v_action->'params'->>'lookup_by', 'to');
            IF v_task_id IS NOT NULL THEN
              IF v_target_status_id IS NOT NULL THEN
                IF v_lookup_by = 'from' THEN
                  SELECT tsh.assigned_to_at_change INTO v_previous_owner
                  FROM public.task_status_history tsh
                  WHERE tsh.task_id = v_task_id
                    AND tsh.from_status_id = v_target_status_id
                    AND tsh.assigned_to_at_change IS NOT NULL
                  ORDER BY tsh.changed_at DESC
                  LIMIT 1;
                ELSE
                  SELECT tsh.assigned_to_at_change INTO v_previous_owner
                  FROM public.task_status_history tsh
                  WHERE tsh.task_id = v_task_id
                    AND tsh.to_status_id = v_target_status_id
                    AND tsh.assigned_to_at_change IS NOT NULL
                  ORDER BY tsh.changed_at DESC
                  OFFSET 1
                  LIMIT 1;
                END IF;

                IF v_previous_owner IS NOT NULL THEN
                  UPDATE tasks SET assigned_to = v_previous_owner WHERE id = v_task_id;
                ELSIF v_fallback_role_id IS NOT NULL THEN
                  SELECT pm.user_id INTO v_role_holder
                  FROM project_members pm
                  WHERE pm.project_id = p_project_id
                    AND pm.project_role_id = v_fallback_role_id
                    AND pm.removed_at IS NULL
                  ORDER BY (
                    SELECT COUNT(*) FROM tasks t
                    JOIN workflow_statuses ws ON ws.id = t.status_id
                    WHERE t.assigned_to = pm.user_id AND ws.category != 'done'
                  ) ASC
                  LIMIT 1;
                  IF v_role_holder.user_id IS NOT NULL THEN
                    UPDATE tasks SET assigned_to = v_role_holder.user_id WHERE id = v_task_id;
                  ELSE
                    v_action_result := 'failed';
                    v_error_msg := 'reassign_to_stage_owner: no previous holder at target status and no fallback role holder';
                  END IF;
                ELSE
                  v_action_result := 'failed';
                  v_error_msg := 'reassign_to_stage_owner: no previous holder and no fallback role';
                END IF;
              ELSE
                v_action_result := 'failed';
                v_error_msg := 'reassign_to_stage_owner: missing target status param';
              END IF;
            END IF;

          WHEN 'add_comment' THEN
            IF v_task_id IS NOT NULL THEN
              INSERT INTO task_comments (task_id, author_type, body)
              VALUES (v_task_id, 'system', v_action->'params'->>'body');
            END IF;

          WHEN 'resolve_blocker' THEN
            IF p_entity_type = 'blocker' THEN
              UPDATE task_blockers SET status = 'resolved',
                resolved_at = now(),
                resolved_by = (SELECT id FROM users WHERE role IN ('admin', 'project_manager') AND (v_project_tenant_id IS NULL OR tenant_id = v_project_tenant_id) LIMIT 1)
              WHERE id = p_entity_id AND status = 'open';
            END IF;

          WHEN 'notify_user' THEN
            v_recipient := COALESCE(v_action->'params'->>'recipient', 'task_assignee');
            v_notification_type := COALESCE(v_action->'params'->>'notification_type', 'automation');
            v_notify_title := COALESCE(v_action->'params'->>'title', 'Automation Notification');
            v_message_template := COALESCE(v_action->'params'->>'message_template', '');

            IF v_task_id IS NOT NULL THEN
              SELECT t.title, p.name, u.full_name
              INTO v_task_title, v_project_name, v_assignee_name
              FROM tasks t
              LEFT JOIN projects p ON p.id = t.project_id
              LEFT JOIN users u ON u.id = t.assigned_to
              WHERE t.id = v_task_id;
            END IF;

            v_resolved_message := v_message_template;
            v_resolved_message := REPLACE(v_resolved_message, '{task_title}', COALESCE(v_task_title, ''));
            v_resolved_message := REPLACE(v_resolved_message, '{project_name}', COALESCE(v_project_name, ''));
            v_resolved_message := REPLACE(v_resolved_message, '{assignee_name}', COALESCE(v_assignee_name, ''));

            CASE v_recipient
              WHEN 'task_assignee' THEN
                IF v_task_id IS NOT NULL THEN
                  SELECT assigned_to INTO v_notify_user_id FROM tasks WHERE id = v_task_id;
                  IF v_notify_user_id IS NOT NULL THEN
                    INSERT INTO notifications (user_id, type, channel, metadata, read)
                    VALUES (v_notify_user_id, v_notification_type, 'in_app',
                      jsonb_build_object('title', v_notify_title, 'message', v_resolved_message, 'project_id', p_project_id),
                      false);
                  END IF;
                END IF;

              WHEN 'specific_user' THEN
                v_notify_user_id := (v_action->'params'->>'user_id')::UUID;
                IF v_notify_user_id IS NOT NULL THEN
                  INSERT INTO notifications (user_id, type, channel, metadata, read)
                  VALUES (v_notify_user_id, v_notification_type, 'in_app',
                    jsonb_build_object('title', v_notify_title, 'message', v_resolved_message, 'project_id', p_project_id),
                    false);
                END IF;

              WHEN 'admins_managers' THEN
                INSERT INTO notifications (user_id, type, channel, metadata, read)
                SELECT u.id, v_notification_type, 'in_app',
                  jsonb_build_object('title', v_notify_title, 'message', v_resolved_message, 'project_id', p_project_id),
                  false
                FROM users u
                WHERE u.status = 'active'
                  AND (v_project_tenant_id IS NULL OR u.tenant_id = v_project_tenant_id)
                  AND (
                    u.role = 'admin'
                    OR (
                      u.role = 'project_manager'
                      AND EXISTS (
                        SELECT 1 FROM project_members pm
                        WHERE pm.project_id = p_project_id
                          AND pm.user_id = u.id
                          AND pm.removed_at IS NULL
                      )
                    )
                  );

              WHEN 'project_members' THEN
                INSERT INTO notifications (user_id, type, channel, metadata, read)
                SELECT pm.user_id, v_notification_type, 'in_app',
                  jsonb_build_object('title', v_notify_title, 'message', v_resolved_message, 'project_id', p_project_id),
                  false
                FROM project_members pm
                WHERE pm.project_id = p_project_id
                  AND pm.removed_at IS NULL;

              ELSE
                v_action_result := 'failed';
                v_error_msg := 'notify_user: unknown recipient type: ' || v_recipient;
            END CASE;

          ELSE
            v_action_result := 'failed';
            v_error_msg := 'Unknown action type: ' || (v_action->>'type');
        END CASE;
      EXCEPTION WHEN OTHERS THEN
        v_action_result := 'failed';
        v_error_msg := SQLERRM;
      END;

      IF v_action_result = 'failed' THEN
        EXIT;
      END IF;
    END LOOP;

    INSERT INTO automation_rule_runs (automation_rule_id, entity_type, entity_id, root_event_id, result, error_message)
    VALUES (v_rule.id, p_entity_type, p_entity_id, v_actual_root_id, v_action_result, v_error_msg);

    IF v_rule.allow_triggering_other_rules AND v_action_result = 'success' THEN
      PERFORM public.run_automation_rules(
        p_project_id, p_trigger_type, p_entity_type, p_entity_id, v_actual_root_id
      );
    END IF;
  END LOOP;
END;
$$;

