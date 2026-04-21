
-- 1. Ensure settings exist in system_settings
INSERT INTO public.system_settings (key, value)
VALUES 
  ('auto_clockout_time', '00:00'),
  ('timezone', 'Asia/Karachi')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value;

-- 2. Update pg_cron to trigger at 12:00 AM PKT (19:00 UTC)
-- Note: pg_cron in Supabase runs in UTC. 19:00 UTC corresponds to 00:00 PKT (UTC+5).
SELECT cron.unschedule('auto-clockout-midnight');

SELECT cron.schedule(
  'auto-clockout-midnight-pkt',
  '0 19 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://goutpygixoxkgbrfmkey.supabase.co/functions/v1/auto-clockout',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvdXRweWdpeG94a2dicmZta2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzAyNTAsImV4cCI6MjA5MTMwNjI1MH0.QS-CXAblzMQdpk33rpn1ybbgF_dXfZfgIJu5Z9ZcSGs"}'::jsonb,
      body := '{"trigger": "cron"}'::jsonb
    ) AS request_id;
  $$
);
