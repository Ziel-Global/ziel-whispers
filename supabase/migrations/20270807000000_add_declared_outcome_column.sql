-- Migration: Add declared_outcome_status_id column to daily_logs table
ALTER TABLE public.daily_logs
ADD COLUMN IF NOT EXISTS declared_outcome_status_id UUID REFERENCES public.workflow_statuses(id) ON DELETE SET NULL;
