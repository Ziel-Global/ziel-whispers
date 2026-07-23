-- Add hours field to leave_requests table
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS hours integer;
