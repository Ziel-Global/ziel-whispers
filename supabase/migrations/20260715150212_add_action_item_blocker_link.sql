-- Link Action Items with Blockers

-- 1. Add visible_to_client toggle to action items
ALTER TABLE public.client_action_items
  ADD COLUMN IF NOT EXISTS visible_to_client BOOLEAN DEFAULT false NOT NULL;

-- 2. Add blocker link to action items
ALTER TABLE public.client_action_items
  ADD COLUMN IF NOT EXISTS blocker_id UUID REFERENCES public.task_blockers(id) ON DELETE SET NULL;

-- 3. Add requires_client_action to task_blockers (referenced in code but never existed)
ALTER TABLE public.task_blockers
  ADD COLUMN IF NOT EXISTS requires_client_action BOOLEAN DEFAULT false NOT NULL;
