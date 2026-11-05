-- 20271027000000_module1_workforce_analytics_foundation.sql
-- Workforce Analytics & KPI Blueprint - Module 1: Foundation Schema Additions

-- 1. Create company holidays table
CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'PK',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT holidays_date_region_unique UNIQUE (date, region)
);

-- Enable RLS on holidays
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read holidays"
  ON public.holidays FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admins to manage holidays"
  ON public.holidays FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- 2. Add reporting hierarchy and attrition tracking to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS reports_to UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_department_head BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS left_at DATE NULL,
  ADD COLUMN IF NOT EXISTS exit_reason TEXT NULL;

-- Index for manager hierarchy queries
CREATE INDEX IF NOT EXISTS idx_users_reports_to ON public.users(reports_to);
CREATE INDEX IF NOT EXISTS idx_users_department_head ON public.users(department, is_department_head) WHERE is_department_head = true;

-- 3. Add project delivery and financial flag fields to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_billable BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS billing_type TEXT NOT NULL DEFAULT 't_and_m',
  ADD COLUMN IF NOT EXISTS budget_hours NUMERIC(10, 2) NULL,
  ADD COLUMN IF NOT EXISTS baseline_end_date DATE NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_billing_type_check'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_billing_type_check
      CHECK (billing_type IN ('fixed', 't_and_m', 'retainer', 'internal'));
  END IF;
END $$;

-- 4. Add allocation percentage to project_members
ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS allocation_percentage NUMERIC(5, 2) NOT NULL DEFAULT 100.00;

-- 5. Add started_at timestamp to tasks (for direct cycle time tracking)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NULL;

-- 6. Insert default break minutes into system_settings if not present
INSERT INTO public.system_settings (key, value)
VALUES ('default_break_minutes', '60')
ON CONFLICT (key) DO NOTHING;
