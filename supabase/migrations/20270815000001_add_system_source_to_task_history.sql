-- Migration: Add source and automation_rule_id to task_status_history
ALTER TABLE public.task_status_history
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS automation_rule_id UUID REFERENCES public.automation_rules(id);

COMMENT ON COLUMN public.task_status_history.source IS 'Origin of status change: manual, daily_log, system, or automation.';
COMMENT ON COLUMN public.task_status_history.automation_rule_id IS 'ID of the automation rule that triggered the transition if source is system/automation.';
