-- Update the daily_logs_category_check constraint to include the new categories
-- categories: marketing, seo, research, posting, designing

ALTER TABLE public.daily_logs DROP CONSTRAINT IF EXISTS daily_logs_category_check;

ALTER TABLE public.daily_logs ADD CONSTRAINT daily_logs_category_check 
CHECK (category = ANY (ARRAY[
  'development'::text, 
  'meeting'::text, 
  'bug_fix'::text, 
  'code_review'::text, 
  'deployment'::text, 
  'documentation'::text, 
  'testing'::text, 
  'marketing'::text, 
  'seo'::text, 
  'research'::text, 
  'posting'::text, 
  'designing'::text, 
  'other'::text
]));
