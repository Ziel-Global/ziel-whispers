-- Add read column to the existing notifications table
ALTER TABLE public.notifications
ADD COLUMN read BOOLEAN DEFAULT false NOT NULL;

-- Add index for performance
CREATE INDEX idx_notifications_user_id_read ON public.notifications(user_id, read);

-- Add channel value for in-app notifications
-- Note: channel already defaults to 'email', so existing notifications are email
