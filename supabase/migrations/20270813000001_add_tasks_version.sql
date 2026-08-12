-- Migration: Add version column to tasks table for optimistic concurrency control
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.tasks.version IS 'Incremented on every write to status_id or assigned_to for optimistic concurrency control.';
