-- Update pg_cron to run every minute to support dynamic auto clock-out times
-- This ensures that whatever time is set in the admin panel, the system will process it within 1 minute.

SELECT cron.unschedule('auto-clockout-midnight-pkt');

SELECT cron.schedule(
  'auto-clockout-dynamic',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://goutpygixoxkgbrfmkey.supabase.co/functions/v1/auto-clockout',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvdXRweWdpeG94a2dicmZta2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzAyNTAsImV4cCI6MjA5MTMwNjI1MH0.QS-CXAblzMQdpk33rpn1ybbgF_dXfZfgIJu5Z9ZcSGs"}'::jsonb,
      body := '{"trigger": "cron"}'::jsonb
    ) AS request_id;
  $$
);
