-- M4: Task Dependencies & Critical Path
-- Creates task_dependencies with cycle prevention, task_schedule_snapshots,
-- RLS, and the compute-critical-path function for the nightly cron job.

-- 1. task_dependencies table
CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'finish_to_start' CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(task_id, depends_on_task_id)
);

-- 2. task_schedule_snapshots table
CREATE TABLE IF NOT EXISTS public.task_schedule_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  earliest_start DATE,
  earliest_finish DATE,
  latest_start DATE,
  latest_finish DATE,
  slack_days INTEGER,
  is_critical BOOLEAN DEFAULT false,
  UNIQUE(task_id, snapshot_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON public.task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON public.task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_task_schedule_snapshots_task_id ON public.task_schedule_snapshots(task_id);
CREATE INDEX IF NOT EXISTS idx_task_schedule_snapshots_date ON public.task_schedule_snapshots(snapshot_date);

-- 3. Cycle prevention trigger
CREATE OR REPLACE FUNCTION public.prevent_dependency_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE dep_chain AS (
      SELECT task_id, depends_on_task_id
      FROM task_dependencies
      WHERE task_id = NEW.depends_on_task_id
      UNION ALL
      SELECT td.task_id, td.depends_on_task_id
      FROM task_dependencies td
      INNER JOIN dep_chain dc ON dc.depends_on_task_id = td.task_id
    )
    SELECT 1 FROM dep_chain WHERE depends_on_task_id = NEW.task_id
  ) THEN
    RAISE EXCEPTION 'Circular dependency detected'
      USING HINT = 'This dependency would create a cycle in the dependency graph';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_dependency_cycle ON public.task_dependencies;
CREATE TRIGGER trg_prevent_dependency_cycle
  BEFORE INSERT ON public.task_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_dependency_cycle();

-- 4. RLS
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_schedule_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_task_dependencies" ON public.task_dependencies;
DROP POLICY IF EXISTS "employee_all_task_dependencies" ON public.task_dependencies;
DROP POLICY IF EXISTS "admin_all_task_schedule_snapshots" ON public.task_schedule_snapshots;
DROP POLICY IF EXISTS "employee_read_task_schedule_snapshots" ON public.task_schedule_snapshots;

CREATE POLICY "admin_all_task_dependencies" ON public.task_dependencies
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "employee_all_task_dependencies" ON public.task_dependencies
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'employee');

CREATE POLICY "admin_all_task_schedule_snapshots" ON public.task_schedule_snapshots
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "employee_read_task_schedule_snapshots" ON public.task_schedule_snapshots
  FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'employee');

-- 5. Compute critical path for a single project
CREATE OR REPLACE FUNCTION public.compute_critical_path(p_project_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshot_date DATE := CURRENT_DATE;
  v_project_start DATE;
  v_project_end DATE;
  v_tasks_processed INTEGER;
BEGIN
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
  SELECT t.id, GREATEST(1, CEIL(COALESCE(t.estimated_hours, 8) / 8.0))::INTEGER
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

-- Wrapper to compute all active projects
CREATE OR REPLACE FUNCTION public.compute_all_critical_paths()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_project RECORD;
BEGIN
  FOR v_project IN SELECT id FROM projects WHERE status IN ('active', 'on_hold')
  LOOP
    PERFORM public.compute_critical_path(v_project.id);
  END LOOP;
END;
$$;

-- Schedule nightly cron (requires pg_cron extension)
-- SELECT cron.schedule('compute-critical-path-nightly', '0 3 * * *', 'SELECT compute_all_critical_paths()');
