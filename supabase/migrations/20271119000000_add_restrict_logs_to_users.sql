ALTER TABLE public.users ADD COLUMN IF NOT EXISTS restrict_logs BOOLEAN NOT NULL DEFAULT true;
COMMENT ON COLUMN public.users.restrict_logs IS 'When true (Require Assigned Tasks), user must log against an assigned task (Other task disabled). When false, user may select Other task.';
