ALTER TABLE public.users ADD COLUMN IF NOT EXISTS restrict_logs BOOLEAN NOT NULL DEFAULT true;
COMMENT ON COLUMN public.users.restrict_logs IS 'When false, user may submit logs without project/task selection.';
