-- M5: Health, Burndown & Reporting
-- Creates project_health_snapshots, project_status_updates, compute_project_health function, and RLS

-- 1. project_health_snapshots table
CREATE TABLE IF NOT EXISTS public.project_health_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  health_status TEXT NOT NULL CHECK (health_status IN ('on_track', 'at_risk', 'delayed')),
  planned_hours NUMERIC DEFAULT 0,
  logged_hours NUMERIC DEFAULT 0,
  tasks_total INTEGER DEFAULT 0,
  tasks_complete INTEGER DEFAULT 0,
  tasks_overdue INTEGER DEFAULT 0,
  open_blockers INTEGER DEFAULT 0,
  UNIQUE(project_id, snapshot_date)
);

-- 2. project_status_updates table
CREATE TABLE IF NOT EXISTS public.project_status_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL DEFAULT 'human' CHECK (author_type IN ('human', 'ai')),
  author_id UUID REFERENCES public.users(id),
  summary TEXT NOT NULL,
  visible_to_client BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_health_project_date ON public.project_health_snapshots(project_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_project_status_updates_project ON public.project_status_updates(project_id, created_at DESC);

-- 3. RLS
ALTER TABLE public.project_health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_status_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_health_snapshots" ON public.project_health_snapshots;
DROP POLICY IF EXISTS "employee_read_health_snapshots" ON public.project_health_snapshots;
DROP POLICY IF EXISTS "admin_all_status_updates" ON public.project_status_updates;
DROP POLICY IF EXISTS "employee_read_status_updates" ON public.project_status_updates;
DROP POLICY IF EXISTS "employee_insert_status_updates" ON public.project_status_updates;
DROP POLICY IF EXISTS "employee_update_status_updates" ON public.project_status_updates;

CREATE POLICY "admin_all_health_snapshots" ON public.project_health_snapshots
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "employee_read_health_snapshots" ON public.project_health_snapshots
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = project_health_snapshots.project_id AND user_id = auth.uid() AND removed_at IS NULL
  ));

CREATE POLICY "admin_all_status_updates" ON public.project_status_updates
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "employee_read_status_updates" ON public.project_status_updates
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = project_status_updates.project_id AND user_id = auth.uid() AND removed_at IS NULL
  ));

CREATE POLICY "employee_insert_status_updates" ON public.project_status_updates
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND author_type = 'human'
    AND EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = project_status_updates.project_id AND user_id = auth.uid() AND removed_at IS NULL
    )
  );

CREATE POLICY "employee_update_status_updates" ON public.project_status_updates
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- 4. Compute project health function
CREATE OR REPLACE FUNCTION public.compute_project_health(p_project_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshot_date DATE := CURRENT_DATE;
  v_tasks_total INT; v_tasks_complete INT; v_tasks_overdue INT;
  v_planned NUMERIC; v_logged NUMERIC; v_open_blockers INT;
  v_variance NUMERIC; v_health TEXT;
  v_critical_blocker_count INT;
  v_oldest_blocker_days INT;
  v_phase_past_due BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_tasks_total FROM tasks WHERE project_id = p_project_id;

  SELECT COUNT(*) INTO v_tasks_complete
  FROM tasks t JOIN workflow_statuses ws ON ws.id = t.status_id
  WHERE t.project_id = p_project_id AND ws.category = 'done';

  SELECT COUNT(*) INTO v_tasks_overdue
  FROM tasks t JOIN workflow_statuses ws ON ws.id = t.status_id
  WHERE t.project_id = p_project_id AND t.due_date < v_snapshot_date AND ws.category != 'done';

  SELECT COALESCE(SUM(estimated_hours), 0) INTO v_planned
  FROM tasks WHERE project_id = p_project_id AND estimated_hours IS NOT NULL;

  SELECT COALESCE(SUM(dl.hours), 0) INTO v_logged
  FROM daily_logs dl WHERE dl.project_id = p_project_id AND dl.status = 'submitted';

  SELECT COUNT(*) INTO v_open_blockers
  FROM task_blockers WHERE project_id = p_project_id AND status = 'open';

  SELECT COUNT(*) INTO v_critical_blocker_count
  FROM task_blockers tb
  JOIN task_schedule_snapshots tss ON tss.task_id = tb.task_id AND tss.is_critical = true
  WHERE tb.project_id = p_project_id AND tb.status = 'open';

  SELECT COALESCE(MAX(v_snapshot_date - tb.raised_at::DATE), 999) INTO v_oldest_blocker_days
  FROM task_blockers tb WHERE tb.project_id = p_project_id AND tb.status = 'open';

  SELECT EXISTS (
    SELECT 1 FROM project_phases pp
    WHERE pp.project_id = p_project_id AND pp.due_date < v_snapshot_date
    AND (SELECT COUNT(*) FROM tasks t WHERE t.phase_id = pp.id) > 0
    AND (SELECT COUNT(*) FROM tasks t JOIN workflow_statuses ws ON ws.id = t.status_id
         WHERE t.phase_id = pp.id AND ws.category = 'done') * 100.0
        / NULLIF((SELECT COUNT(*) FROM tasks t WHERE t.phase_id = pp.id), 0) < 50
  ) INTO v_phase_past_due;

  v_variance := CASE WHEN v_planned > 0 THEN ((v_planned - v_logged) / v_planned) * 100 ELSE 0 END;

  -- Health status per spec 6.2
  IF v_tasks_overdue = 0 AND v_open_blockers = 0 AND v_critical_blocker_count = 0 THEN
    v_health := 'on_track';
  ELSIF v_variance > 25 OR v_phase_past_due OR v_oldest_blocker_days > 5
        OR (v_critical_blocker_count > 0 AND v_oldest_blocker_days > 2) THEN
    v_health := 'delayed';
  ELSE
    v_health := 'at_risk';
  END IF;

  INSERT INTO project_health_snapshots
    (project_id, snapshot_date, health_status, planned_hours, logged_hours,
     tasks_total, tasks_complete, tasks_overdue, open_blockers)
  VALUES
    (p_project_id, v_snapshot_date, v_health, v_planned, v_logged,
     v_tasks_total, v_tasks_complete, v_tasks_overdue, v_open_blockers)
  ON CONFLICT (project_id, snapshot_date) DO UPDATE SET
    health_status = EXCLUDED.health_status,
    planned_hours = EXCLUDED.planned_hours,
    logged_hours = EXCLUDED.logged_hours,
    tasks_total = EXCLUDED.tasks_total,
    tasks_complete = EXCLUDED.tasks_complete,
    tasks_overdue = EXCLUDED.tasks_overdue,
    open_blockers = EXCLUDED.open_blockers;
END;
$$;

-- 5. Wrapper for all active projects
CREATE OR REPLACE FUNCTION public.compute_all_project_health()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_project RECORD;
BEGIN
  FOR v_project IN SELECT id FROM projects WHERE status IN ('active', 'on_hold')
  LOOP
    PERFORM public.compute_project_health(v_project.id);
  END LOOP;
END;
$$;

-- Schedule nightly (requires pg_cron)
SELECT cron.schedule('compute-project-health-daily', '0 2 * * *', 'SELECT compute_all_project_health()');
