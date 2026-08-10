-- Migration: Add status_id column to daily_logs table
ALTER TABLE public.daily_logs
ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES public.workflow_statuses(id) ON DELETE SET NULL;
