-- Schedule nightly critical path computation at midnight
SELECT cron.schedule(
  'compute-critical-path-nightly',
  '0 0 * * *',
  'SELECT compute_all_critical_paths()'
);
