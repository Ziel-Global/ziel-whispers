-- Phase 2: Sprints belong to phases

-- 1. Add phase_id to sprints
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES public.project_phases(id) ON DELETE CASCADE;

-- 2. Backfill: assign each sprint to the first phase of its project
UPDATE sprints s SET phase_id = (
  SELECT id FROM project_phases pp
  WHERE pp.project_id = s.project_id
  ORDER BY pp.created_at LIMIT 1
) WHERE phase_id IS NULL;

-- 3. Make phase_id NOT NULL
ALTER TABLE sprints ALTER COLUMN phase_id SET NOT NULL;

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_sprints_phase_id ON sprints(phase_id);

-- 5. Validate task's phase matches its sprint's phase
CREATE OR REPLACE FUNCTION public.validate_task_phase_sprint()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sprint_id IS NOT NULL AND NEW.phase_id IS NOT NULL THEN
    IF (SELECT phase_id FROM sprints WHERE id = NEW.sprint_id) != NEW.phase_id THEN
      RAISE EXCEPTION 'Task phase must match its assigned sprint''s phase';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_task_phase_sprint ON tasks;
CREATE TRIGGER trg_validate_task_phase_sprint
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION validate_task_phase_sprint();
