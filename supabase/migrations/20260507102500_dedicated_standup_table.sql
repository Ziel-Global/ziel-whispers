-- 1. Remove the standup_done column from daily_logs as it's better tracked separately
ALTER TABLE public.daily_logs DROP COLUMN IF EXISTS standup_done;

-- 2. Create a dedicated standups table to track status independently of work logs
CREATE TABLE public.daily_standups (
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    date date NOT NULL,
    is_done boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, date)
);

-- 3. Enable RLS
ALTER TABLE public.daily_standups ENABLE ROW LEVEL SECURITY;

-- 4. Policies
CREATE POLICY "Admins can manage daily standups" ON public.daily_standups
    FOR ALL TO authenticated
    USING (public.get_my_role() = 'admin')
    WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "Users can view their own standups" ON public.daily_standups
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());
