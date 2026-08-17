-- Migration: Split daily_logs status fields into hours_status_id and declared_transition_to
ALTER TABLE public.daily_logs 
ADD COLUMN IF NOT EXISTS hours_status_id UUID REFERENCES public.workflow_statuses(id),
ADD COLUMN IF NOT EXISTS declared_transition_to UUID REFERENCES public.workflow_statuses(id);

COMMENT ON COLUMN public.daily_logs.hours_status_id IS 'Status active when the work hours occurred.';
COMMENT ON COLUMN public.daily_logs.declared_transition_to IS 'Optional requested status move upon log submission.';
