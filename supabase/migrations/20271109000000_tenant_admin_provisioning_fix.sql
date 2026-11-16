-- Migration: 20271109000000_tenant_admin_provisioning_fix.sql
-- Description: Separates tenant owners/administrators from standard HR workforce records.
--   1. Schema fix: relax workforce-only constraints/defaults on public.users.
--   2. RPC fix:    provision_tenant_workspace now supplies employment_type and upserts the
--                  auth-created user row, repointing it to the newly created tenant.
--   3. Trigger:    handle_new_user() recognises user_type = 'tenant_admin' and skips
--                  standard HR/workforce defaults.

-- ============================================================================
-- 1. Schema Fix
-- ============================================================================
ALTER TABLE public.users ALTER COLUMN employment_type DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN employment_type SET DEFAULT 'full-time';
ALTER TABLE public.users ALTER COLUMN department SET DEFAULT 'Management';
ALTER TABLE public.users ALTER COLUMN designation SET DEFAULT 'Administrator';

-- ============================================================================
-- 2. RPC Update: provision_tenant_workspace
-- ============================================================================
CREATE OR REPLACE FUNCTION public.provision_tenant_workspace(
    p_tenant_name TEXT,
    p_tenant_slug TEXT,
    p_admin_user_id UUID,
    p_admin_email TEXT,
    p_admin_full_name TEXT,
    p_primary_color TEXT DEFAULT '17 84% 52%',
    p_secondary_color TEXT DEFAULT '40 8% 96%',
    p_logo_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_clean_slug TEXT;
BEGIN
    -- Verify SSA Permissions
    IF public.platform_role() NOT IN ('Master_SSA', 'Provisioning_SSA') THEN
        RAISE EXCEPTION 'Access Denied: Caller does not possess SSA provisioning authority.';
    END IF;

    -- Validate Inputs
    IF trim(COALESCE(p_tenant_name, '')) = '' THEN
        RAISE EXCEPTION 'Tenant name cannot be empty.';
    END IF;

    v_clean_slug := lower(regexp_replace(trim(COALESCE(p_tenant_slug, '')), '[^a-zA-Z0-9\-]', '-', 'g'));
    IF v_clean_slug = '' THEN
        RAISE EXCEPTION 'Tenant slug cannot be empty.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_clean_slug) THEN
        RAISE EXCEPTION 'Tenant with slug % already exists.', v_clean_slug;
    END IF;

    -- 1. Create Tenant Record
    INSERT INTO public.tenants (name, slug, status)
    VALUES (trim(p_tenant_name), v_clean_slug, 'active')
    RETURNING id INTO v_tenant_id;

    -- 2. Create Default White-Label Branding
    INSERT INTO public.tenant_branding (
        tenant_id,
        app_name,
        logo_url,
        primary_color,
        secondary_color
    ) VALUES (
        v_tenant_id,
        trim(p_tenant_name),
        p_logo_url,
        COALESCE(p_primary_color, '17 84% 52%'),
        COALESCE(p_secondary_color, '40 8% 96%')
    );

    -- 3. Upsert Tenant Admin in public.users.
    --    The auth.users trigger (handle_new_user) has usually already created a row for this
    --    id under the default tenant, so repoint it to the new tenant on conflict.
    INSERT INTO public.users (
        id,
        tenant_id,
        email,
        full_name,
        role,
        department,
        designation,
        employment_type,
        join_date,
        status,
        working_days,
        must_change_password
    ) VALUES (
        p_admin_user_id,
        v_tenant_id,
        trim(lower(p_admin_email)),
        trim(p_admin_full_name),
        'admin',
        'Executive',
        'Tenant Administrator',
        'full-time',
        CURRENT_DATE,
        'active',
        5,
        false
    )
    ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        department = EXCLUDED.department,
        designation = EXCLUDED.designation,
        employment_type = COALESCE(public.users.employment_type, EXCLUDED.employment_type),
        status = 'active',
        working_days = EXCLUDED.working_days,
        must_change_password = EXCLUDED.must_change_password;

    -- 4. Seed Bare Minimum System Settings (Timezone, Shift Hours, Session Timeout)
    INSERT INTO public.system_settings (tenant_id, key, value) VALUES
        (v_tenant_id, 'app_name', trim(p_tenant_name)),
        (v_tenant_id, 'timezone', 'Asia/Karachi'),
        (v_tenant_id, 'default_shift_start', '09:00'),
        (v_tenant_id, 'default_shift_end', '18:00'),
        (v_tenant_id, 'session_timeout_hours', '12')
    ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value;

    -- 5. Seed Bare Minimum Leave Types (Annual & Sick only)
    INSERT INTO public.leave_types (tenant_id, name, days_allowed) VALUES
        (v_tenant_id, 'Annual Leave', 14),
        (v_tenant_id, 'Sick Leave', 8)
    ON CONFLICT (tenant_id, name) DO NOTHING;

    RETURN v_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_tenant_workspace(
    TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- ============================================================================
-- 3. Auth Trigger Update: handle_new_user
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_type text;
BEGIN
  v_tenant_id := COALESCE(
    (new.raw_user_meta_data->>'tenant_id')::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
  );
  v_user_type := new.raw_user_meta_data->>'user_type';

  IF v_user_type = 'tenant_admin' THEN
    -- Tenant owner / platform-provisioned administrator: NOT a workforce member.
    -- No HR defaults (employment_type stays NULL, no 'Management'/'full-time' fill-ins).
    -- provision_tenant_workspace() finalises the row and repoints it to the new tenant.
    INSERT INTO public.users (
      id,
      tenant_id,
      email,
      full_name,
      role,
      status,
      designation,
      department,
      employment_type,
      join_date
    )
    VALUES (
      new.id,
      v_tenant_id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'full_name', new.email),
      COALESCE(new.raw_user_meta_data->>'role', 'admin'),
      'active',
      COALESCE(new.raw_user_meta_data->>'designation', 'Tenant Administrator'),
      COALESCE(new.raw_user_meta_data->>'department', 'Executive'),
      NULL,
      NOW()::date
    )
    ON CONFLICT (id) DO UPDATE SET
      tenant_id = COALESCE(public.users.tenant_id, EXCLUDED.tenant_id),
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role;
  ELSE
    -- Standard workforce user (unchanged behaviour)
    INSERT INTO public.users (
      id,
      tenant_id,
      email,
      full_name,
      role,
      status,
      designation,
      department,
      employment_type,
      join_date
    )
    VALUES (
      new.id,
      v_tenant_id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'full_name', 'System Admin'),
      COALESCE(new.raw_user_meta_data->>'role', 'employee'),
      'active',
      COALESCE(new.raw_user_meta_data->>'designation', 'Administrator'),
      COALESCE(new.raw_user_meta_data->>'department', 'Management'),
      COALESCE(new.raw_user_meta_data->>'employment_type', 'full-time'),
      COALESCE((new.raw_user_meta_data->>'join_date')::date, NOW()::date)
    )
    ON CONFLICT (id) DO UPDATE SET
      tenant_id = COALESCE(public.users.tenant_id, EXCLUDED.tenant_id),
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role;
  END IF;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user trigger error for user %: %', new.id, SQLERRM;
  RETURN new;
END;
$$;

