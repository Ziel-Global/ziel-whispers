-- Update the default session timeout to 12 hours in system_settings
UPDATE public.system_settings 
SET value = '12' 
WHERE key = 'session_timeout_hours';

-- Ensure the key exists if it doesn't already
INSERT INTO public.system_settings (key, value)
VALUES ('session_timeout_hours', '12')
ON CONFLICT (key) DO NOTHING;
