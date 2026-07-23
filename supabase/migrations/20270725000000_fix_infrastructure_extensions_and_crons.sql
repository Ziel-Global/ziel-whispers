-- Safety-net migration: ensure pg_cron + pg_net extensions are enabled,
-- then reschedule all 7 cron jobs with correct frequencies.
-- Each job is wrapped in its own DO block so one failure never blocks the rest.-for testing

-- ============================================================
-- 1. Ensure extensions are enabled
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================
-- 2. Reschedule all 7 cron jobs
-- ============================================================

-- Job 1: auto-clockout-dynamic (every hour)
DO $$ BEGIN
  PERFORM cron.unschedule('auto-clockout-dynamic');
EXCEPTION WHEN OTHERS THEN
END; $$;

DO $$ BEGIN
  PERFORM cron.unschedule('auto-clockout-midnight-pkt');
EXCEPTION WHEN OTHERS THEN
END; $$;

DO $$ BEGIN
  PERFORM cron.unschedule('auto-clockout-midnight');
EXCEPTION WHEN OTHERS THEN
END; $$;

SELECT cron.schedule(
  'auto-clockout-dynamic',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://jjgdpnociwltzcukbrft.supabase.co/functions/v1/auto-clockout',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZ2Rwbm9jaXdsdHpjdWticmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTkyMDAsImV4cCI6MjA5MTk5NTIwMH0.OxQXFWsybKLYoEaGde39VN6eOp84E0ruziKhlEmRSow"}'::jsonb,
      body := '{"trigger": "cron"}'::jsonb
    ) AS request_id;
  $$
);

-- Job 2: detect-missed-logs-dynamic (every hour, down from every 30 min)
DO $$ BEGIN
  PERFORM cron.unschedule('detect-missed-logs-dynamic');
EXCEPTION WHEN OTHERS THEN
END; $$;

SELECT cron.schedule(
  'detect-missed-logs-dynamic',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://jjgdpnociwltzcukbrft.supabase.co/functions/v1/detect-missed-logs',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZ2Rwbm9jaXdsdHpjdWticmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTkyMDAsImV4cCI6MjA5MTk5NTIwMH0.OxQXFWsybKLYoEaGde39VN6eOp84E0ruziKhlEmRSow"}'::jsonb,
      body := '{"trigger": "cron"}'::jsonb
    ) AS request_id;
  $$
);

-- Job 3: send-log-reminder (every 5 min — no change)
DO $$ BEGIN
  PERFORM cron.unschedule('send-log-reminder');
EXCEPTION WHEN OTHERS THEN
END; $$;

SELECT cron.schedule(
  'send-log-reminder',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://jjgdpnociwltzcukbrft.supabase.co/functions/v1/send-log-reminder',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZ2Rwbm9jaXdsdHpjdWticmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTkyMDAsImV4cCI6MjA5MTk5NTIwMH0.OxQXFWsybKLYoEaGde39VN6eOp84E0ruziKhlEmRSow"}'::jsonb,
      body := '{"trigger": "cron"}'::jsonb
    ) AS request_id;
  $$
);

-- Job 4: cleanup-expired-remote-access (daily midnight — no change)
DO $$ BEGIN
  PERFORM cron.unschedule('cleanup-expired-remote-access');
EXCEPTION WHEN OTHERS THEN
END; $$;

SELECT cron.schedule(
  'cleanup-expired-remote-access',
  '0 0 * * *',
  'SELECT public.cleanup_expired_remote_access();'
);

-- Job 5: compute-project-health-daily (daily 2 AM — no change)
DO $$ BEGIN
  PERFORM cron.unschedule('compute-project-health-daily');
EXCEPTION WHEN OTHERS THEN
END; $$;

SELECT cron.schedule(
  'compute-project-health-daily',
  '0 2 * * *',
  'SELECT compute_all_project_health()'
);

-- Job 6: compute-critical-path-nightly (daily midnight — no change)
DO $$ BEGIN
  PERFORM cron.unschedule('compute-critical-path-nightly');
EXCEPTION WHEN OTHERS THEN
END; $$;

SELECT cron.schedule(
  'compute-critical-path-nightly',
  '0 0 * * *',
  'SELECT compute_all_critical_paths()'
);

-- Job 7: run-scheduled-automations (every 15 min — no change)
DO $$ BEGIN
  PERFORM cron.unschedule('run-scheduled-automations');
EXCEPTION WHEN OTHERS THEN
END; $$;

SELECT cron.schedule(
  'run-scheduled-automations',
  '*/15 * * * *',
  'SELECT public.run_scheduled_automations();'
);
