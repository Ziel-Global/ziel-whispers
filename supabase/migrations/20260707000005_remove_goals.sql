-- Stage 0: Remove Goals entirely
-- Drop goal_resources first (FK to goals), then goals, then goal_id from tasks

DROP TABLE IF EXISTS public.goal_resources CASCADE;

DROP TABLE IF EXISTS public.goals CASCADE;

ALTER TABLE public.tasks DROP COLUMN IF EXISTS goal_id;
