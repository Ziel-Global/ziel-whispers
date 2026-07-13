-- Removes story_points from tasks and drops sprint velocity features

-- Drop story_points column from tasks
ALTER TABLE tasks DROP COLUMN IF EXISTS story_points;

-- Drop sprint velocity compute functions
DROP FUNCTION IF EXISTS public.compute_sprint_snapshot;
DROP FUNCTION IF EXISTS public.compute_all_active_sprint_snapshots;

-- Drop sprint_snapshots table (and its RLS policies)
DROP TABLE IF EXISTS public.sprint_snapshots CASCADE;
