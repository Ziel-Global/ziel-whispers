
-- Add auto clock-out tracking to attendance
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS auto_clocked_out boolean NOT NULL DEFAULT false;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS auto_clockout_notes text;

-- Add night shift flag to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_night_shift boolean NOT NULL DEFAULT false;

-- Create acknowledgment table for auto clock-out alerts
CREATE TABLE public.auto_clockout_acks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  attendance_id uuid NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_clockout_acks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own acks"
ON public.auto_clockout_acks
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own acks"
ON public.auto_clockout_acks
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Unique constraint to prevent duplicate acks
CREATE UNIQUE INDEX idx_auto_clockout_acks_unique ON public.auto_clockout_acks (user_id, attendance_id);
