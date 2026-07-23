-- Phase 1: Project Settings table and updated RPCs

-- 1. project_settings table
CREATE TABLE IF NOT EXISTS public.project_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  at_risk_variance_percent NUMERIC DEFAULT 10 NOT NULL,
  delayed_variance_percent NUMERIC DEFAULT 25 NOT NULL,
  blocker_warning_days INTEGER DEFAULT 5 NOT NULL,
  critical_blocker_warning_days INTEGER DEFAULT 2 NOT NULL,
  hours_per_day NUMERIC DEFAULT 8 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_settings_project_id ON public.project_settings(project_id);

ALTER TABLE public.project_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_settings_select" ON public.project_settings;
CREATE POLICY "project_settings_select"
  ON public.project_settings FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_settings_insert" ON public.project_settings;
CREATE POLICY "project_settings_insert"
  ON public.project_settings FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_settings_update" ON public.project_settings;
CREATE POLICY "project_settings_update"
  ON public.project_settings FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- 2. Auto-insert default row when a project is created
CREATE OR REPLACE FUNCTION public.create_default_project_settings()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.project_settings (project_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_project_settings ON public.projects;
CREATE TRIGGER trg_create_project_settings
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_project_settings();

-- 3. Backfill for existing projects
INSERT INTO public.project_settings (project_id)
SELECT id FROM public.projects p
WHERE NOT EXISTS (SELECT 1 FROM public.project_settings WHERE project_id = p.id);

-- 4. Updated compute_project_health that reads from project_settings
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
  v_at_risk_variance NUMERIC;
  v_delayed_variance NUMERIC;
  v_blocker_warning INT;
  v_critical_blocker_warning INT;
BEGIN
  SELECT
    COALESCE(ps.at_risk_variance_percent, 10),
    COALESCE(ps.delayed_variance_percent, 25),
    COALESCE(ps.blocker_warning_days, 5),
    COALESCE(ps.critical_blocker_warning_days, 2)
  INTO v_at_risk_variance, v_delayed_variance, v_blocker_warning, v_critical_blocker_warning
  FROM project_settings ps WHERE ps.project_id = p_project_id;

  IF v_at_risk_variance IS NULL THEN v_at_risk_variance := 10; END IF;
  IF v_delayed_variance IS NULL THEN v_delayed_variance := 25; END IF;
  IF v_blocker_warning IS NULL THEN v_blocker_warning := 5; END IF;
  IF v_critical_blocker_warning IS NULL THEN v_critical_blocker_warning := 2; END IF;

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

  -- Health status using per-project thresholds
  IF v_tasks_overdue = 0 AND v_open_blockers = 0 AND v_critical_blocker_count = 0
     AND v_variance <= v_at_risk_variance THEN
    v_health := 'on_track';
  ELSIF v_variance > v_delayed_variance OR v_phase_past_due
        OR v_oldest_blocker_days > v_blocker_warning
        OR (v_critical_blocker_count > 0 AND v_oldest_blocker_days > v_critical_blocker_warning) THEN
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

-- 5. Updated compute_critical_path that uses project_settings.hours_per_day
CREATE OR REPLACE FUNCTION public.compute_critical_path(p_project_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshot_date DATE := CURRENT_DATE;
  v_project_start DATE;
  v_project_end DATE;
  v_tasks_processed INTEGER;
  v_hours_per_day NUMERIC;
BEGIN
  SELECT COALESCE(ps.hours_per_day, 8) INTO v_hours_per_day
  FROM project_settings ps WHERE ps.project_id = p_project_id;
  IF v_hours_per_day IS NULL THEN v_hours_per_day := 8; END IF;

  SELECT start_date, COALESCE(end_date, start_date + INTERVAL '90 days')::DATE
  INTO v_project_start, v_project_end
  FROM projects WHERE id = p_project_id;
  IF v_project_start IS NULL THEN RETURN; END IF;

  CREATE TEMP TABLE IF NOT EXISTS _cp (
    task_id UUID PRIMARY KEY,
    duration INTEGER DEFAULT 1,
    es DATE, ef DATE,
    ls DATE, lf DATE,
    processed BOOLEAN DEFAULT false
  ) ON COMMIT DROP;

  INSERT INTO _cp (task_id, duration)
  SELECT t.id, GREATEST(1, CEIL(COALESCE(t.estimated_hours, v_hours_per_day) / v_hours_per_day))::INTEGER
  FROM tasks t WHERE t.project_id = p_project_id;

  -- Forward pass (topological order)
  LOOP
    UPDATE _cp cp
    SET es = COALESCE(
          (SELECT MAX(cp2.ef) + 1 FROM _cp cp2
           JOIN task_dependencies td ON td.depends_on_task_id = cp2.task_id
           WHERE td.task_id = cp.task_id AND cp2.processed),
          v_project_start),
        ef = COALESCE(
          (SELECT MAX(cp2.ef) + 1 FROM _cp cp2
           JOIN task_dependencies td ON td.depends_on_task_id = cp2.task_id
           WHERE td.task_id = cp.task_id AND cp2.processed),
          v_project_start) + cp.duration - 1,
        processed = true
    WHERE NOT cp.processed
      AND (
        SELECT COUNT(*) FROM task_dependencies td
        WHERE td.task_id = cp.task_id
          AND NOT EXISTS (SELECT 1 FROM _cp cp2 WHERE cp2.task_id = td.depends_on_task_id AND cp2.processed)
      ) = 0;
    GET DIAGNOSTICS v_tasks_processed = ROW_COUNT;
    EXIT WHEN v_tasks_processed = 0;
  END LOOP;

  UPDATE _cp SET es = v_project_start, ef = v_project_start + duration - 1, processed = true
  WHERE NOT processed;

  -- Reset for backward pass
  UPDATE _cp SET processed = false;

  -- Backward pass (reverse topological order)
  LOOP
    UPDATE _cp cp
    SET lf = COALESCE(
          (SELECT MIN(cp2.ls) - 1 FROM _cp cp2
           JOIN task_dependencies td ON td.task_id = cp2.task_id
           WHERE td.depends_on_task_id = cp.task_id AND cp2.processed),
          v_project_end),
        ls = COALESCE(
          (SELECT MIN(cp2.ls) - 1 FROM _cp cp2
           JOIN task_dependencies td ON td.task_id = cp2.task_id
           WHERE td.depends_on_task_id = cp.task_id AND cp2.processed),
          v_project_end) - cp.duration + 1,
        processed = true
    WHERE NOT cp.processed
      AND (
        SELECT COUNT(*) FROM task_dependencies td
        WHERE td.depends_on_task_id = cp.task_id
          AND NOT EXISTS (SELECT 1 FROM _cp cp2 WHERE cp2.task_id = td.task_id AND cp2.processed)
      ) = 0;
    GET DIAGNOSTICS v_tasks_processed = ROW_COUNT;
    EXIT WHEN v_tasks_processed = 0;
  END LOOP;

  UPDATE _cp SET lf = v_project_end, ls = v_project_end - duration + 1 WHERE NOT processed;

  -- Write snapshots
  INSERT INTO task_schedule_snapshots (task_id, snapshot_date, earliest_start, earliest_finish, latest_start, latest_finish, slack_days, is_critical)
  SELECT task_id, v_snapshot_date, es, ef, ls, lf, (ls - es) AS slack_days, (ls - es) = 0 AS is_critical
  FROM _cp
  ON CONFLICT (task_id, snapshot_date) DO UPDATE SET
    earliest_start = EXCLUDED.earliest_start,
    earliest_finish = EXCLUDED.earliest_finish,
    latest_start = EXCLUDED.latest_start,
    latest_finish = EXCLUDED.latest_finish,
    slack_days = EXCLUDED.slack_days,
    is_critical = EXCLUDED.is_critical;
END;
$$;
