-- Migration: 20271106020000_phase3_tenant_provisioning_and_ssa_rpcs.sql
-- Description: Phase 3 Tenant Provisioning & SSA Management Procedures
-- Implements the atomic provision_tenant_workspace RPC, SSA role assignment/revocation,
-- tenant status management (suspension/activation), and tenants overview reporting RPC.

-- ============================================================================
-- 1. Bootstrap First Master SSA (One-time bootstrap gate)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.bootstrap_first_master_ssa(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only allow if no Master_SSA currently exists in the platform
    IF EXISTS (SELECT 1 FROM public.platform_roles WHERE role = 'Master_SSA') THEN
        RAISE EXCEPTION 'Access Denied: A Master_SSA is already registered in the system.';
    END IF;

    INSERT INTO public.platform_roles (user_id, role, granted_by)
    VALUES (p_user_id, 'Master_SSA', p_user_id)
    ON CONFLICT (user_id) DO UPDATE SET role = 'Master_SSA';

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_first_master_ssa(UUID) TO authenticated;

-- ============================================================================
-- 2. Platform Role Assignment & Revocation (Master_SSA Only)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_platform_role(
    p_user_id UUID,
    p_role public.platform_role_type
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.platform_role() != 'Master_SSA' THEN
        RAISE EXCEPTION 'Access Denied: Only Master_SSA can assign platform roles.';
    END IF;

    INSERT INTO public.platform_roles (user_id, role, granted_by)
    VALUES (p_user_id, p_role, auth.uid())
    ON CONFLICT (user_id) DO UPDATE 
        SET role = EXCLUDED.role,
            granted_by = EXCLUDED.granted_by,
            created_at = now();

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_platform_role(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.platform_role() != 'Master_SSA' THEN
        RAISE EXCEPTION 'Access Denied: Only Master_SSA can revoke platform roles.';
    END IF;

    -- Prevent Master SSA from accidentally locking themselves out if they are the last one
    IF p_user_id = auth.uid() AND (SELECT count(*) FROM public.platform_roles WHERE role = 'Master_SSA') <= 1 THEN
        RAISE EXCEPTION 'Cannot revoke role: You are the sole Master_SSA on this platform.';
    END IF;

    DELETE FROM public.platform_roles WHERE user_id = p_user_id;
    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_platform_role(UUID, public.platform_role_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_platform_role(UUID) TO authenticated;

-- ============================================================================
-- 3. Atomic Tenant Provisioning RPC (`provision_tenant_workspace`)
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

    -- 3. Create Default Tenant Admin User Account in public.users
    INSERT INTO public.users (
        id,
        tenant_id,
        email,
        full_name,
        role,
        department,
        designation,
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
        'active',
        5,
        false
    );

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
-- 4. Tenant Status Lifecycle Management (Master_SSA Only)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_tenant_status(
    p_tenant_id UUID,
    p_status public.tenant_status
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.platform_role() != 'Master_SSA' THEN
        RAISE EXCEPTION 'Access Denied: Only Master_SSA can alter tenant workspace status.';
    END IF;

    UPDATE public.tenants
    SET status = p_status,
        updated_at = now()
    WHERE id = p_tenant_id;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_tenant_status(UUID, public.tenant_status) TO authenticated;

-- ============================================================================
-- 5. SSA Master Overview Query RPC (`get_tenants_overview`)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_tenants_overview()
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    status public.tenant_status,
    created_at TIMESTAMPTZ,
    app_name TEXT,
    logo_url TEXT,
    primary_color TEXT,
    secondary_color TEXT,
    total_users BIGINT,
    active_users BIGINT,
    admin_email TEXT,
    admin_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.platform_role() IS NULL THEN
        RAISE EXCEPTION 'Access Denied: Only Platform SSAs can access tenant overview telemetry.';
    END IF;

    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.slug,
        t.status,
        t.created_at,
        b.app_name,
        b.logo_url,
        b.primary_color,
        b.secondary_color,
        COALESCE(u_stats.total_users, 0::bigint) AS total_users,
        COALESCE(u_stats.active_users, 0::bigint) AS active_users,
        adm.email AS admin_email,
        adm.full_name AS admin_name
    FROM public.tenants t
    LEFT JOIN public.tenant_branding b ON b.tenant_id = t.id
    LEFT JOIN (
        SELECT 
            u.tenant_id,
            count(*) AS total_users,
            count(*) FILTER (WHERE u.status = 'active') AS active_users
        FROM public.users u
        GROUP BY u.tenant_id
    ) u_stats ON u_stats.tenant_id = t.id
    LEFT JOIN LATERAL (
        SELECT u2.email, u2.full_name
        FROM public.users u2
        WHERE u2.tenant_id = t.id AND u2.role = 'admin'
        ORDER BY u2.created_at ASC
        LIMIT 1
    ) adm ON true
    ORDER BY t.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenants_overview() TO authenticated;

