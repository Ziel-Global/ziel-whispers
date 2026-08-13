/**
 * B2 Migration Script — applies the migration directly to Supabase via Management API
 * Run: node scripts/apply_b2_migration.mjs
 *
 * You need your Supabase Personal Access Token.
 * Get it from: https://supabase.com/dashboard/account/tokens
 */



const SQL = `
-- B2-A: Add retired column to workflow_statuses
ALTER TABLE public.workflow_statuses
  ADD COLUMN IF NOT EXISTS retired BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_workflow_statuses_retired
  ON public.workflow_statuses (workflow_template_id, retired);

-- B2-B: Add allowed_role_ids column to workflow_transitions
ALTER TABLE public.workflow_transitions
  ADD COLUMN IF NOT EXISTS allowed_role_ids UUID[] DEFAULT NULL;

-- B2-B: Update validate_task_status_transition trigger function for role-gating
CREATE OR REPLACE FUNCTION public.validate_task_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workflow_template_id UUID;
  v_allowed_role_ids     UUID[];
  v_changed_by_type      TEXT;
  v_acting_user_role     TEXT;
  v_user_project_role_id UUID;
BEGIN
  -- Skip if status_id hasn't changed
  IF TG_OP = 'UPDATE' AND OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  -- Resolve the workflow template for this task's project
  SELECT p.workflow_template_id INTO v_workflow_template_id
  FROM public.projects p
  WHERE p.id = NEW.project_id;

  -- Transition existence check
  IF TG_OP = 'UPDATE' AND OLD.status_id IS NOT NULL AND NEW.status_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.workflow_transitions
      WHERE workflow_template_id = v_workflow_template_id
        AND from_status_id = OLD.status_id
        AND to_status_id   = NEW.status_id
    ) THEN
      RAISE EXCEPTION 'Invalid task status transition: % -> % is not allowed in this workflow',
        OLD.status_id, NEW.status_id;
    END IF;
  END IF;

  -- B2-B: Role-gating check
  IF TG_OP = 'UPDATE' AND OLD.status_id IS NOT NULL AND NEW.status_id IS NOT NULL THEN
    SELECT wt.allowed_role_ids INTO v_allowed_role_ids
    FROM public.workflow_transitions wt
    WHERE wt.workflow_template_id = v_workflow_template_id
      AND wt.from_status_id = OLD.status_id
      AND wt.to_status_id   = NEW.status_id
    LIMIT 1;

    IF v_allowed_role_ids IS NOT NULL AND array_length(v_allowed_role_ids, 1) > 0 THEN
      BEGIN
        v_changed_by_type := NULLIF(current_setting('app.task_changed_by_type', true), '');
      EXCEPTION WHEN OTHERS THEN
        v_changed_by_type := NULL;
      END;

      IF v_changed_by_type IN ('admin', 'system', 'auto') THEN
        NULL;
      ELSE
        SELECT u.role INTO v_acting_user_role
        FROM public.users u
        WHERE u.id = auth.uid();

        IF v_acting_user_role IN ('admin', 'manager') THEN
          NULL;
        ELSE
          SELECT pm.project_role_id INTO v_user_project_role_id
          FROM public.project_members pm
          WHERE pm.user_id    = auth.uid()
            AND pm.project_id = NEW.project_id
            AND pm.removed_at IS NULL
          LIMIT 1;

          IF v_user_project_role_id IS NULL
             OR NOT (v_user_project_role_id = ANY(v_allowed_role_ids))
          THEN
            RAISE EXCEPTION 'Access denied: Your project role is not authorised to make this workflow transition.';
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Dual-write status text column
  IF NEW.status_id IS NOT NULL THEN
    SELECT name INTO NEW.status
    FROM public.workflow_statuses
    WHERE id = NEW.status_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_task_status_transition ON public.tasks;
CREATE TRIGGER trg_validate_task_status_transition
  BEFORE INSERT OR UPDATE OF status_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_status_transition();

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
`;

const VERIFY_SQL = `
SELECT table_name, column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name IN ('workflow_statuses', 'workflow_transitions')
  AND column_name IN ('retired', 'allowed_role_ids')
ORDER BY table_name, column_name;
`;

async function runSQL(sql, label) {
  console.log(`\n▶ Running: ${label}...`);
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    console.error(`✗ ${label} FAILED (HTTP ${res.status}):`);
    console.error(typeof data === "object" ? JSON.stringify(data, null, 2) : data);
    return false;
  }

  console.log(`✓ ${label} SUCCESS:`);
  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log("  (no rows returned)");
    } else {
      console.table(data);
    }
  } else {
    console.log(typeof data === "object" ? JSON.stringify(data, null, 2) : data);
  }
  return true;
}

async function main() {
  if (ACCESS_TOKEN === "PASTE_YOUR_TOKEN_HERE") {
    console.error("❌ ERROR: No access token set.");
    console.error("");
    console.error("Get your token from: https://supabase.com/dashboard/account/tokens");
    console.error("Then run:");
    console.error("  $env:SUPABASE_ACCESS_TOKEN='your_token_here'");
    console.error("  node scripts/apply_b2_migration.mjs");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════");
  console.log("  B2 Migration: workflow_statuses + workflow_transitions");
  console.log("  Project:", PROJECT_REF);
  console.log("═══════════════════════════════════════════════════");

  const migrationOk = await runSQL(SQL, "B2 Schema Migration");
  if (!migrationOk) {
    console.error("\n❌ Migration failed. Check error above and fix before re-running.");
    process.exit(1);
  }

  // Give PostgREST a moment to reload
  await new Promise(r => setTimeout(r, 1500));

  await runSQL(VERIFY_SQL, "Verification — confirming new columns exist");

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  ✅ B2 migration complete!");
  console.log("  Refresh your browser and test the Workflow Templates page.");
  console.log("═══════════════════════════════════════════════════\n");
}

main();
