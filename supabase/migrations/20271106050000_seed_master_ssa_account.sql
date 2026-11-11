-- Migration: 20271106050000_seed_master_ssa_account.sql
-- Description: Assigns contact@zielglobal.com as Master_SSA and confirms email.

DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = 'contact@zielglobal.com' LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        -- Confirm email in auth.users
        UPDATE auth.users
        SET email_confirmed_at = COALESCE(email_confirmed_at, now())
        WHERE id = v_user_id;

        -- Ensure public.users record is active and does not force password change
        UPDATE public.users
        SET status = 'active',
            must_change_password = false,
            role = 'admin',
            designation = 'Platform Master SSA',
            department = 'Executive'
        WHERE id = v_user_id;

        -- Assign Master_SSA role in platform_roles
        INSERT INTO public.platform_roles (user_id, role, granted_by)
        VALUES (v_user_id, 'Master_SSA', v_user_id)
        ON CONFLICT (user_id) DO UPDATE SET role = 'Master_SSA';
    END IF;
END $$;
