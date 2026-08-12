-- 1. Add client_id column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);
CREATE INDEX IF NOT EXISTS idx_users_client_id ON public.users(client_id);

-- 2. Function: when a client portal/member/client user gets a client_id, add them to all client projects
CREATE OR REPLACE FUNCTION public.sync_client_portal_memberships()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS NOT NULL AND NEW.role IN ('client portal', 'client member', 'client') THEN
    INSERT INTO project_members (project_id, user_id, project_role_id)
    SELECT p.id, NEW.id, (
      SELECT id FROM project_roles WHERE project_id = p.id AND name = 'Client' LIMIT 1
    )
    FROM projects p
    WHERE p.client_id = NEW.client_id
      AND NOT EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = NEW.id AND pm.removed_at IS NULL
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_client_memberships ON public.users;
CREATE TRIGGER trg_sync_client_memberships
  AFTER INSERT OR UPDATE OF client_id ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_client_portal_memberships();

-- 3. Function: when a new project is created with a client_id, add all client portal/member/client users for that client
CREATE OR REPLACE FUNCTION public.sync_new_project_client_members()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    INSERT INTO project_members (project_id, user_id, project_role_id)
    SELECT NEW.id, u.id, (
      SELECT id FROM project_roles WHERE project_id = NEW.id AND name = 'Client' LIMIT 1
    )
    FROM users u
    WHERE u.client_id = NEW.client_id
      AND u.role IN ('client portal', 'client member', 'client')
      AND NOT EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = NEW.id AND pm.user_id = u.id AND pm.removed_at IS NULL
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_new_project_client ON public.projects;
CREATE TRIGGER trg_sync_new_project_client
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.sync_new_project_client_members();

-- 4. Add missing DELETE policy on clients table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND cmd = 'DELETE'
  ) THEN
    CREATE POLICY "Admin/Manager can delete clients"
    ON public.clients FOR DELETE TO authenticated
    USING (get_my_role() = ANY(ARRAY['admin'::text, 'manager'::text]));
  END IF;
END $$;
