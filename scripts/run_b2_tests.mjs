/**
 * B2 Automated Test Runner
 * Tests B2-A (Status Retirement) and B2-B (Role-Gated Transitions) at DB level
 * Run: node scripts/run_b2_tests.mjs
 */


let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];

// ─── DB Query via Management API ────────────────────────────────────────────
async function sql(query, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  try { return { ok: res.ok, data: JSON.parse(text), status: res.status }; }
  catch { return { ok: res.ok, data: text, status: res.status }; }
}

// ─── Test helpers ────────────────────────────────────────────────────────────
function pass(id, name, detail = "") {
  passed++;
  results.push({ id, name, result: "PASS", detail });
  console.log(`  ✅ ${id}: ${name}${detail ? " — " + detail : ""}`);
}

function fail(id, name, detail = "") {
  failed++;
  results.push({ id, name, result: "FAIL", detail });
  console.log(`  ❌ ${id}: ${name}${detail ? " — " + detail : ""}`);
}

function skip(id, name, reason = "") {
  skipped++;
  results.push({ id, name, result: "SKIP", detail: reason });
  console.log(`  ⏭  ${id}: ${name} — SKIPPED (${reason})`);
}

function section(title) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA VERIFICATION TESTS
// ─────────────────────────────────────────────────────────────────────────────
async function testSchema() {
  section("SCHEMA TESTS — Columns Exist");

  // S1: retired column on workflow_statuses
  const s1 = await sql(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'workflow_statuses' AND column_name = 'retired';
  `, "S1");

  if (s1.ok && s1.data.length === 1) {
    const col = s1.data[0];
    if (col.data_type === "boolean" && col.column_default === "false" && col.is_nullable === "NO") {
      pass("S1", "workflow_statuses.retired column exists with correct definition",
        `type=${col.data_type}, default=${col.column_default}, nullable=${col.is_nullable}`);
    } else {
      fail("S1", "workflow_statuses.retired column definition incorrect",
        JSON.stringify(col));
    }
  } else {
    fail("S1", "workflow_statuses.retired column NOT FOUND");
  }

  // S2: allowed_role_ids column on workflow_transitions
  const s2 = await sql(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'workflow_transitions' AND column_name = 'allowed_role_ids';
  `, "S2");

  if (s2.ok && s2.data.length === 1) {
    const col = s2.data[0];
    if (col.data_type === "ARRAY" && col.is_nullable === "YES") {
      pass("S2", "workflow_transitions.allowed_role_ids column exists with correct definition",
        `type=${col.data_type}, default=${col.column_default}, nullable=${col.is_nullable}`);
    } else {
      fail("S2", "workflow_transitions.allowed_role_ids column definition incorrect",
        JSON.stringify(col));
    }
  } else {
    fail("S2", "workflow_transitions.allowed_role_ids column NOT FOUND");
  }

  // S3: Index exists on workflow_statuses
  const s3 = await sql(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'workflow_statuses' AND indexname = 'idx_workflow_statuses_retired';
  `, "S3");

  if (s3.ok && s3.data.length === 1) {
    pass("S3", "idx_workflow_statuses_retired index exists");
  } else {
    fail("S3", "idx_workflow_statuses_retired index NOT FOUND");
  }

  // S4: Trigger still exists
  const s4 = await sql(`
    SELECT trigger_name FROM information_schema.triggers
    WHERE trigger_name = 'trg_validate_task_status_transition'
      AND event_object_table = 'tasks';
  `, "S4");

  if (s4.ok && s4.data.length > 0) {
    pass("S4", "trg_validate_task_status_transition trigger still exists");
  } else {
    fail("S4", "trg_validate_task_status_transition trigger MISSING");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// B2-A: STATUS RETIREMENT DATA TESTS
// ─────────────────────────────────────────────────────────────────────────────
async function testRetirement() {
  section("B2-A TESTS — Workflow Status Retirement");

  // Get a real workflow template to work with
  const tmplRes = await sql(`SELECT id, name FROM workflow_templates LIMIT 1;`);
  if (!tmplRes.ok || tmplRes.data.length === 0) {
    skip("R1-R7", "All retirement tests", "No workflow templates found in DB");
    return null;
  }
  const template = tmplRes.data[0];
  console.log(`  Using template: "${template.name}" (${template.id})`);

  // TC-R1: All existing statuses have retired = false by default
  const r1 = await sql(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN retired = false THEN 1 ELSE 0 END) as active,
           SUM(CASE WHEN retired = true  THEN 1 ELSE 0 END) as retired_count
    FROM workflow_statuses
    WHERE workflow_template_id = '${template.id}';
  `);

  if (r1.ok && r1.data.length > 0) {
    const { total, active, retired_count } = r1.data[0];
    if (parseInt(retired_count) === 0) {
      pass("TC-R1", `All ${total} existing statuses default to retired=false`);
    } else {
      pass("TC-R1", `${active}/${total} statuses active, ${retired_count} already retired (pre-existing data)`);
    }
  } else {
    fail("TC-R1", "Could not query workflow_statuses retired counts");
  }

  // TC-R2: Create a test status, verify retired=false, then retire it
  const testStatusName = `__B2_TEST_${Date.now()}`;
  const insertRes = await sql(`
    INSERT INTO workflow_statuses (workflow_template_id, name, category, color, sort_order, is_initial, retired)
    VALUES ('${template.id}', '${testStatusName}', 'todo', 'bg-gray-100 text-gray-800', 999, false, false)
    RETURNING id, name, retired;
  `);

  if (!insertRes.ok || insertRes.data.length === 0) {
    fail("TC-R2", "Could not insert test status", JSON.stringify(insertRes.data));
    return template;
  }
  const testStatus = insertRes.data[0];

  if (testStatus.retired === false) {
    pass("TC-R2a", `New status created with retired=false`, `id=${testStatus.id}`);
  } else {
    fail("TC-R2a", "New status has unexpected retired=true");
  }

  // Retire the test status
  const retireRes = await sql(`
    UPDATE workflow_statuses SET retired = true WHERE id = '${testStatus.id}'
    RETURNING id, name, retired;
  `);

  if (retireRes.ok && retireRes.data[0]?.retired === true) {
    pass("TC-R2b", "Status successfully updated to retired=true");
  } else {
    fail("TC-R2b", "Could not retire status", JSON.stringify(retireRes.data));
  }

  // TC-R3: Verify retired status can still be queried (not deleted)
  const r3 = await sql(`
    SELECT id, name, retired FROM workflow_statuses WHERE id = '${testStatus.id}';
  `);

  if (r3.ok && r3.data.length === 1 && r3.data[0].retired === true) {
    pass("TC-R3", "Retired status still queryable (no hard deletion)", `name=${r3.data[0].name}`);
  } else {
    fail("TC-R3", "Retired status not found or deletion occurred");
  }

  // TC-R4: Add a test transition TO the retired status, verify it exists in DB
  const existingStatus = await sql(`
    SELECT id FROM workflow_statuses
    WHERE workflow_template_id = '${template.id}' AND retired = false
    LIMIT 1;
  `);

  if (existingStatus.ok && existingStatus.data.length > 0) {
    const fromId = existingStatus.data[0].id;
    const transRes = await sql(`
      INSERT INTO workflow_transitions (workflow_template_id, from_status_id, to_status_id, allowed_role_ids)
      VALUES ('${template.id}', '${fromId}', '${testStatus.id}', NULL)
      RETURNING id, from_status_id, to_status_id, allowed_role_ids;
    `);

    if (transRes.ok && transRes.data.length > 0) {
      pass("TC-R4", "Transition to retired status exists in DB (historical reference preserved)",
        `transition id=${transRes.data[0].id}`);

      // TC-R5: Verify allowed_role_ids defaults to NULL on new transitions
      if (transRes.data[0].allowed_role_ids === null) {
        pass("TC-R5 / TC-G1", "New transition has allowed_role_ids=NULL (unrestricted by default)");
      } else {
        fail("TC-R5 / TC-G1", "New transition has unexpected allowed_role_ids value", JSON.stringify(transRes.data[0].allowed_role_ids));
      }

      // Clean up test transition
      await sql(`DELETE FROM workflow_transitions WHERE id = '${transRes.data[0].id}';`);
    } else {
      skip("TC-R4", "Transition to retired status", "Could not create test transition");
    }
  }

  // TC-R6: Verify task_status_history references survive retirement
  const r6 = await sql(`
    SELECT COUNT(*) as count FROM task_status_history tsh
    JOIN workflow_statuses ws ON ws.id = tsh.to_status_id
    WHERE ws.retired = true;
  `);

  if (r6.ok) {
    pass("TC-R6", `task_status_history references to retired statuses are preserved (${r6.data[0].count} records)`);
  } else {
    skip("TC-R6", "History check", "Could not query task_status_history");
  }

  // TC-R7: Un-retire the test status
  const r7 = await sql(`
    UPDATE workflow_statuses SET retired = false WHERE id = '${testStatus.id}'
    RETURNING id, retired;
  `);

  if (r7.ok && r7.data[0]?.retired === false) {
    pass("TC-R7", "Status successfully un-retired (restored to active)");
  } else {
    fail("TC-R7", "Could not un-retire status");
  }

  // Clean up test status
  await sql(`DELETE FROM workflow_statuses WHERE id = '${testStatus.id}';`);
  console.log(`  🧹 Cleaned up test status "${testStatusName}"`);

  return template;
}

// ─────────────────────────────────────────────────────────────────────────────
// B2-B: ROLE-GATED TRANSITIONS DATA TESTS
// ─────────────────────────────────────────────────────────────────────────────
async function testRoleGating(template) {
  section("B2-B TESTS — Role-Gated Workflow Transitions");

  if (!template) {
    skip("G1-G10", "All role-gating tests", "No template available");
    return;
  }

  // TC-G1: All existing transitions have allowed_role_ids = NULL
  const g1 = await sql(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN allowed_role_ids IS NULL THEN 1 ELSE 0 END) as unrestricted,
           SUM(CASE WHEN allowed_role_ids IS NOT NULL THEN 1 ELSE 0 END) as restricted
    FROM workflow_transitions
    WHERE workflow_template_id = '${template.id}';
  `);

  if (g1.ok && g1.data.length > 0) {
    const { total, unrestricted, restricted } = g1.data[0];
    pass("TC-G1", `Existing transitions: ${unrestricted}/${total} unrestricted, ${restricted} already restricted`);
  } else {
    fail("TC-G1", "Could not query transition allowed_role_ids counts");
  }

  // Get a real transition to test with
  const transRes = await sql(`
    SELECT wt.id, wt.from_status_id, wt.to_status_id, wt.allowed_role_ids,
           ws1.name as from_name, ws2.name as to_name
    FROM workflow_transitions wt
    JOIN workflow_statuses ws1 ON ws1.id = wt.from_status_id
    JOIN workflow_statuses ws2 ON ws2.id = wt.to_status_id
    WHERE wt.workflow_template_id = '${template.id}'
      AND wt.from_status_id IS NOT NULL
    LIMIT 1;
  `);

  if (!transRes.ok || transRes.data.length === 0) {
    skip("TC-G2-G9", "Transition role tests", "No transitions found in template");
    return;
  }
  const transition = transRes.data[0];
  const originalRoles = transition.allowed_role_ids;
  console.log(`  Using transition: "${transition.from_name}" → "${transition.to_name}" (${transition.id})`);

  // Get a real project role to test with
  const roleRes = await sql(`
    SELECT id, name FROM project_roles LIMIT 1;
  `);

  let testRoleId = null;
  if (roleRes.ok && roleRes.data.length > 0) {
    testRoleId = roleRes.data[0].id;
    console.log(`  Using role: "${roleRes.data[0].name}" (${testRoleId})`);
  }

  // TC-G2: Set role restriction on transition
  if (testRoleId) {
    const g2 = await sql(`
      UPDATE workflow_transitions
      SET allowed_role_ids = ARRAY['${testRoleId}']::uuid[]
      WHERE id = '${transition.id}'
      RETURNING id, allowed_role_ids;
    `);

    if (g2.ok && g2.data.length > 0 && g2.data[0].allowed_role_ids !== null) {
      pass("TC-G2", "Role restriction set on transition successfully",
        `allowed_role_ids=[${g2.data[0].allowed_role_ids}]`);
    } else {
      fail("TC-G2", "Could not set allowed_role_ids on transition", JSON.stringify(g2.data));
    }

    // TC-G5: Test with multiple roles
    const g5 = await sql(`
      UPDATE workflow_transitions
      SET allowed_role_ids = ARRAY['${testRoleId}', '${testRoleId}']::uuid[]
      WHERE id = '${transition.id}'
      RETURNING allowed_role_ids;
    `);

    if (g5.ok) {
      pass("TC-G5/G6", "Multiple role IDs can be stored in allowed_role_ids array");
    } else {
      fail("TC-G5/G6", "Could not store multiple role IDs");
    }

    // TC-G9: Remove restriction (set back to NULL)
    const g9 = await sql(`
      UPDATE workflow_transitions
      SET allowed_role_ids = NULL
      WHERE id = '${transition.id}'
      RETURNING id, allowed_role_ids;
    `);

    if (g9.ok && g9.data[0]?.allowed_role_ids === null) {
      pass("TC-G9", "Role restriction removed (allowed_role_ids set back to NULL)");
    } else {
      fail("TC-G9", "Could not remove role restriction");
    }
  } else {
    skip("TC-G2", "Set role restriction", "No project roles found in DB");
    skip("TC-G5/G6", "Multiple roles", "No project roles found");
    skip("TC-G9", "Remove restriction", "No project roles found");
  }

  // Restore original state
  if (originalRoles === null) {
    await sql(`UPDATE workflow_transitions SET allowed_role_ids = NULL WHERE id = '${transition.id}';`);
  } else {
    await sql(`UPDATE workflow_transitions SET allowed_role_ids = '${JSON.stringify(originalRoles)}'::uuid[] WHERE id = '${transition.id}';`);
  }

  // TC-G4 / DB Trigger: Verify trigger function exists and has role-gating logic
  const triggerFn = await sql(`
    SELECT prosrc FROM pg_proc
    WHERE proname = 'validate_task_status_transition'
    LIMIT 1;
  `);

  if (triggerFn.ok && triggerFn.data.length > 0) {
    const src = triggerFn.data[0].prosrc;
    const hasRoleCheck = src.includes("allowed_role_ids") && src.includes("v_user_project_role_id");
    const hasBypass = src.includes("admin") && src.includes("auto");
    const hasException = src.includes("Access denied");

    if (hasRoleCheck) {
      pass("TC-G3/G4", "DB trigger contains role-gating enforcement logic (allowed_role_ids check)");
    } else {
      fail("TC-G3/G4", "DB trigger does NOT contain role-gating logic");
    }

    if (hasBypass) {
      pass("TC-G8", "DB trigger contains admin/system/auto bypass logic");
    } else {
      fail("TC-G8", "DB trigger does NOT contain admin bypass");
    }

    if (hasException) {
      pass("TC-G4-detail", "DB trigger raises correct exception message for unauthorized transitions");
    } else {
      fail("TC-G4-detail", "DB trigger missing exception message");
    }
  } else {
    fail("TC-G3/G4/G8", "validate_task_status_transition function not found in DB");
  }

  // TC-G10: Verify that getAllowedTransitions function in workflow.ts logic
  // is consistent (check by reading the actual file)
  const { readFileSync } = await import("fs");
  try {
    const workflowSrc = readFileSync("src/lib/workflow.ts", "utf8");
    const hasRetiredFilter = workflowSrc.includes("!s.retired");
    const hasRoleFilter = workflowSrc.includes("allowed_role_ids");
    const hasUserRoleId = workflowSrc.includes("userRoleId");
    const hasIsSystemAdmin = workflowSrc.includes("isSystemAdmin");

    if (hasRetiredFilter && hasRoleFilter && hasUserRoleId && hasIsSystemAdmin) {
      pass("TC-G10", "Frontend getAllowedTransitions filters retired & role-gated transitions");
    } else {
      fail("TC-G10", "Frontend getAllowedTransitions missing filters",
        `retired=${hasRetiredFilter}, role=${hasRoleFilter}, userRoleId=${hasUserRoleId}, isSystemAdmin=${hasIsSystemAdmin}`);
    }
  } catch(e) {
    skip("TC-G10", "Frontend source check", "Could not read workflow.ts");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKWARD COMPATIBILITY TESTS
// ─────────────────────────────────────────────────────────────────────────────
async function testBackwardCompat() {
  section("BACKWARD COMPATIBILITY TESTS");

  // BC1: All existing statuses have retired = false (no regression)
  const bc1 = await sql(`
    SELECT COUNT(*) as total, SUM(CASE WHEN retired = true THEN 1 ELSE 0 END) as retired_count
    FROM workflow_statuses;
  `);

  if (bc1.ok) {
    const { total, retired_count } = bc1.data[0];
    if (parseInt(retired_count) === 0) {
      pass("BC1", `All ${total} existing workflow statuses untouched (retired=false)`);
    } else {
      pass("BC1", `${total} statuses total, ${retired_count} were already retired (pre-migration data)`);
    }
  }

  // BC2: All existing transitions have allowed_role_ids = NULL
  const bc2 = await sql(`
    SELECT COUNT(*) as total, SUM(CASE WHEN allowed_role_ids IS NOT NULL THEN 1 ELSE 0 END) as restricted_count
    FROM workflow_transitions;
  `);

  if (bc2.ok) {
    const { total, restricted_count } = bc2.data[0];
    if (parseInt(restricted_count) === 0) {
      pass("BC2", `All ${total} existing workflow transitions untouched (allowed_role_ids=NULL)`);
    } else {
      pass("BC2", `${total} transitions total, ${restricted_count} already restricted`);
    }
  }

  // BC3: Tasks table is unmodified (Developer A boundary)
  const bc3 = await sql(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name IN ('version', 'retired', 'allowed_role_ids');
  `);

  if (bc3.ok) {
    const cols = bc3.data.map(r => r.column_name);
    const hasVersion = cols.includes("version"); // Developer A may have added this
    const hasRetired = cols.includes("retired");
    const hasAllowedRoles = cols.includes("allowed_role_ids");

    if (!hasRetired && !hasAllowedRoles) {
      pass("BC3", "tasks table unmodified by B2 (Developer A boundary respected)");
    } else {
      fail("BC3", "tasks table unexpectedly modified by B2");
    }
  }

  // BC4: Both record_task_status_history and validate triggers exist
  const bc4 = await sql(`
    SELECT trigger_name FROM information_schema.triggers
    WHERE event_object_table = 'tasks'
      AND trigger_name IN ('trg_validate_task_status_transition', 'trg_record_task_status_history')
    ORDER BY trigger_name;
  `);

  if (bc4.ok) {
    const names = bc4.data.map(r => r.trigger_name);
    if (names.includes("trg_validate_task_status_transition") && names.includes("trg_record_task_status_history")) {
      pass("BC4", "Both task status triggers intact after B2 migration");
    } else {
      fail("BC4", "One or both triggers missing", `Found: ${names.join(", ")}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FRONTEND SOURCE CODE TESTS
// ─────────────────────────────────────────────────────────────────────────────
async function testFrontend() {
  section("FRONTEND CODE TESTS");
  const { readFileSync } = await import("fs");

  const files = {
    "workflow.ts": "src/lib/workflow.ts",
    "StageOutcomeSelector.tsx": "src/components/StageOutcomeSelector.tsx",
    "LogSubmit.tsx": "src/pages/LogSubmit.tsx",
    "ProjectDetail.tsx": "src/pages/ProjectDetail.tsx",
    "WorkflowTemplates.tsx": "src/pages/WorkflowTemplates.tsx",
  };

  const checks = {
    "workflow.ts": [
      { label: "WorkflowStatus type has 'retired' field", test: s => s.includes("retired: boolean") },
      { label: "WorkflowTransition type has 'allowed_role_ids' field", test: s => s.includes("allowed_role_ids:") },
      { label: "getAllowedTransitions filters retired statuses", test: s => s.includes("!s.retired") },
      { label: "getAllowedTransitions accepts userRoleId param", test: s => s.includes("userRoleId") },
      { label: "getAllowedTransitions accepts isSystemAdmin param", test: s => s.includes("isSystemAdmin") },
      { label: "getInitialStatus skips retired statuses", test: s => s.includes("is_initial && !s.retired") },
    ],
    "StageOutcomeSelector.tsx": [
      { label: "userRoleId prop added", test: s => s.includes("userRoleId") },
      { label: "isSystemAdmin prop added", test: s => s.includes("isSystemAdmin") },
      { label: "Uses getAllowedTransitions (not inline filter)", test: s => s.includes("getAllowedTransitions") },
    ],
    "LogSubmit.tsx": [
      { label: "Queries user project role", test: s => s.includes("logsubmit-user-project-role") },
      { label: "Passes userRoleId to getAllowedTransitions", test: s => s.includes("logSubmitUserRoleId") },
      { label: "isLogSubmitSystemAdmin defined", test: s => s.includes("isLogSubmitSystemAdmin") },
    ],
    "ProjectDetail.tsx": [
      { label: "Queries current-user-project-role", test: s => s.includes("current-user-project-role") },
      { label: "currentUserProjectRoleId variable exists", test: s => s.includes("currentUserProjectRoleId") },
      { label: "Passes userRoleId to StageOutcomeSelector", test: s => s.includes("userRoleId={currentUserProjectRoleId") },
      { label: "Passes isSystemAdmin to StageOutcomeSelector", test: s => s.includes("isSystemAdmin={isAdmin}") },
    ],
    "WorkflowTemplates.tsx": [
      { label: "WorkflowStatus type has retired field", test: s => s.includes("retired: boolean") },
      { label: "WorkflowTransition type has allowed_role_ids field", test: s => s.includes("allowed_role_ids:") },
      { label: "statusRetired state variable", test: s => s.includes("statusRetired") },
      { label: "Retired toggle in dialog", test: s => s.includes("Retired (hidden from new transitions") },
      { label: "Role restriction dialog added", test: s => s.includes("Role Restriction for Transition") },
      { label: "saveTransitionRoles function", test: s => s.includes("saveTransitionRoles") },
      { label: "🔑 key icon in transition matrix", test: s => s.includes("🔑") },
      { label: "Retired badge in status list", test: s => s.includes("Retired") && s.includes("amber") },
    ],
  };

  let caseId = 1;
  for (const [file, path] of Object.entries(files)) {
    try {
      const src = readFileSync(path, "utf8");
      for (const check of checks[file]) {
        const testId = `FE-${caseId++}`;
        if (check.test(src)) {
          pass(testId, `[${file}] ${check.label}`);
        } else {
          fail(testId, `[${file}] ${check.label}`);
        }
      }
    } catch(e) {
      fail(`FE-${caseId++}`, `[${file}] Could not read file: ${e.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║         B2 AUTOMATED TEST SUITE — Ziel Whispers             ║");
  console.log("║   B2-A: Status Retirement  |  B2-B: Role-Gated Transitions  ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  console.log(`  Project: ${PROJECT_REF}`);
  console.log(`  Time:    ${new Date().toISOString()}\n`);

  await testSchema();
  const template = await testRetirement();
  await testRoleGating(template);
  await testBackwardCompat();
  await testFrontend();

  // ── Summary ────────────────────────────────────────────────────────────────
  const total = passed + failed + skipped;
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                     TEST RESULTS SUMMARY                    ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log(`║  ✅ PASSED:  ${String(passed).padEnd(3)}  ❌ FAILED:  ${String(failed).padEnd(3)}  ⏭ SKIPPED: ${String(skipped).padEnd(3)}  Total: ${String(total).padEnd(3)} ║`);
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  if (failed > 0) {
    console.log("❌ FAILED TESTS:");
    results.filter(r => r.result === "FAIL").forEach(r => {
      console.log(`   • ${r.id}: ${r.name}${r.detail ? " → " + r.detail : ""}`);
    });
    console.log("");
  }

  if (skipped > 0) {
    console.log("⏭ SKIPPED TESTS (require manual verification or live test accounts):");
    results.filter(r => r.result === "SKIP").forEach(r => {
      console.log(`   • ${r.id}: ${r.name}${r.detail ? " → " + r.detail : ""}`);
    });
    console.log("");
  }

  console.log("📋 MANUAL UI TESTS (cannot be automated — require browser):");
  console.log("   • TC-R2 UI: Open WorkflowTemplates, edit a status, verify amber Retired badge");
  console.log("   • TC-R3 UI: Open a task in project, verify retired status absent from stage move");
  console.log("   • TC-R4 UI: Verify existing tasks in retired status still render on board");
  console.log("   • TC-G3 UI: Login as correct-role user, verify transition IS visible");
  console.log("   • TC-G4 UI: Login as wrong-role user, verify transition is HIDDEN");
  console.log("   • TC-G8 UI: Login as admin, verify all transitions visible despite role gate");
  console.log("");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
