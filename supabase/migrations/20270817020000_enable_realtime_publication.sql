-- Migration: Enable Supabase Realtime publication for task_blockers, client_action_items, and tasks
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_blockers;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.client_action_items;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Table might already be in publication, safe fallback
    NULL;
END $$;
