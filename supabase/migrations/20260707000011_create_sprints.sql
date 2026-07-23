-- M6: Sprints & Velocity
-- Creates sprints, sprint_snapshots tables, adds sprint_id to tasks, RLS, compute functions

-- 1. sprints table
CREATE TABLE IF NOT EXISTS public.sprints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints(project_id);

-- 2. sprint_snapshots table
CREATE TABLE IF NOT EXISTS public.sprint_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sprint_id UUID NOT NULL REFERENCES public.sprints(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  committed_points NUMERIC DEFAULT 0,
  completed_points NUMERIC DEFAULT 0,
  points_added_mid_sprint NUMERIC DEFAULT 0,
  points_removed_mid_sprint NUMERIC DEFAULT 0,
  UNIQUE(sprint_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_sprint_snapshots_sprint_id ON sprint_snapshots(sprint_id);

-- 3. Add sprint_id to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES public.sprints(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);

-- 4. RLS policies — sprints
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on sprints" ON public.sprints;
CREATE POLICY "Admin full access on sprints"
  ON public.sprints FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Employees view sprints on assigned projects" ON public.sprints;
CREATE POLICY "Employees view sprints on assigned projects"
  ON public.sprints FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = sprints.project_id AND user_id = auth.uid() AND removed_at IS NULL
  ));

-- 5. RLS policies — sprint_snapshots
ALTER TABLE public.sprint_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on sprint_snapshots" ON public.sprint_snapshots;
CREATE POLICY "Admin full access on sprint_snapshots"
  ON public.sprint_snapshots FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Employees view snapshots on assigned projects" ON public.sprint_snapshots;
CREATE POLICY "Employees view snapshots on assigned projects"
  ON public.sprint_snapshots FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sprints s
    JOIN public.project_members pm ON pm.project_id = s.project_id
    WHERE s.id = sprint_snapshots.sprint_id AND pm.user_id = auth.uid() AND pm.removed_at IS NULL
  ));

-- 6. compute_sprint_snapshot(p_sprint_id)
CREATE OR REPLACE FUNCTION public.compute_sprint_snapshot(p_sprint_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_first_committed NUMERIC;
  v_current_total NUMERIC := 0;
  v_completed NUMERIC := 0;
  v_added NUMERIC := 0;
  v_removed NUMERIC := 0;
  v_now DATE := CURRENT_DATE;
  v_sprint_status TEXT;
BEGIN
  -- Get sprint status
  SELECT status INTO v_sprint_status FROM public.sprints WHERE id = p_sprint_id;
  IF v_sprint_status IS NULL THEN
    RAISE EXCEPTION 'Sprint not found: %', p_sprint_id;
  END IF;

  -- Get first snapshot committed points
  SELECT committed_points INTO v_first_committed
  FROM public.sprint_snapshots
  WHERE sprint_id = p_sprint_id
  ORDER BY snapshot_date ASC
  LIMIT 1;

  -- Current total story points
  SELECT COALESCE(SUM(COALESCE(t.story_points, 0)), 0)
  INTO v_current_total
  FROM public.tasks t
  WHERE t.sprint_id = p_sprint_id;

  -- Completed points (tasks with done status)
  SELECT COALESCE(SUM(COALESCE(t.story_points, 0)), 0)
  INTO v_completed
  FROM public.tasks t
  JOIN public.workflow_statuses ws ON t.status_id = ws.id
  WHERE t.sprint_id = p_sprint_id AND ws.category = 'done';

  -- Calculate committed / added / removed
  IF v_first_committed IS NULL THEN
    v_first_committed := v_current_total;
  ELSE
    v_added := GREATEST(0, v_current_total - v_first_committed);
    v_removed := GREATEST(0, v_first_committed - v_current_total);
  END IF;

  -- Upsert
  INSERT INTO public.sprint_snapshots (sprint_id, snapshot_date, committed_points, completed_points, points_added_mid_sprint, points_removed_mid_sprint)
  VALUES (p_sprint_id, v_now, v_first_committed, v_completed, v_added, v_removed)
  ON CONFLICT (sprint_id, snapshot_date)
  DO UPDATE SET
    committed_points = EXCLUDED.committed_points,
    completed_points = EXCLUDED.completed_points,
    points_added_mid_sprint = EXCLUDED.points_added_mid_sprint,
    points_removed_mid_sprint = EXCLUDED.points_removed_mid_sprint;
END;
$$;

-- 7. compute_all_active_sprint_snapshots()
CREATE OR REPLACE FUNCTION public.compute_all_active_sprint_snapshots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sprint RECORD;
BEGIN
  FOR v_sprint IN SELECT id FROM public.sprints WHERE status = 'active'
  LOOP
    PERFORM public.compute_sprint_snapshot(v_sprint.id);
  END LOOP;
END;
$$;

-- Cron schedule (uncomment when pg_cron is available)
-- SELECT cron.schedule('compute-sprint-snapshots', '0 0 * * *', 'SELECT compute_all_active_sprint_snapshots()');
