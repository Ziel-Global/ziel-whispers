-- Enable RLS on notifications table (required for policies to take effect)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own in-app notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (user_id = auth.uid());
