-- Schedule missed log detection to run every 30 minutes
-- This allows the system to catch users whose shifts have ended at different times throughout the day.

SELECT cron.schedule(
  'detect-missed-logs-dynamic',
  '*/30 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://goutpygixoxkgbrfmkey.supabase.co/functions/v1/detect-missed-logs',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvdXRweWdpeG94a2dicmZta2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzAyNTAsImV4cCI6MjA5MTMwNjI1MH0.QS-CXAblzMQdpk33rpn1ybbgF_dXfZfgIJu5Z9ZcSGs"}'::jsonb,
      body := '{"trigger": "cron"}'::jsonb
    ) AS request_id;
  $$
);
