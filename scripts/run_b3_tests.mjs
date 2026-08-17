/**
 * B3 Test Runner — Reassignment Engine & Status History
 * Run: node scripts/run_b3_tests.mjs
 */


let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];

async function sql(query) {
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

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║         B3 AUTOMATED TEST SUITE — Ziel Whispers             ║");
  console.log("║    Reassignment Engine & Task Status History Validation      ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // ─────────────────────────────────────────────────────────────────────────
  // 1. STATUS HISTORY & ASSIGNED_TO_AT_CHANGE TESTS
  // ─────────────────────────────────────────────────────────────────────────
  section("1. STATUS HISTORY & ASSIGNED_TO_AT_CHANGE LOGGING");

  // Fetch a project & statuses
  const projRes = await sql(`SELECT id, workflow_template_id FROM projects WHERE workflow_template_id IS NOT NULL LIMIT 1;`);
  if (!projRes.ok || projRes.data.length === 0) {
    fail("B3-1", "No active project found with workflow template");
    return;
  }
  const projectId = projRes.data[0].id;
  const templateId = projRes.data[0].workflow_template_id;

  const statusesRes = await sql(`
    SELECT id, name FROM workflow_statuses
    WHERE workflow_template_id = '${templateId}' AND retired = false
    ORDER BY sort_order ASC
    LIMIT 2;
  `);

  if (!statusesRes.ok || statusesRes.data.length < 2) {
    fail("B3-1", "Not enough active workflow statuses found for test project");
    return;
  }
  const statusA = statusesRes.data[0];
  const statusB = statusesRes.data[1];

  // Fetch a valid user
  const userRes = await sql(`SELECT id FROM users LIMIT 1;`);
  if (!userRes.ok || userRes.data.length === 0) {
    fail("B3-1", "No user found for test task assignment");
    return;
  }
  const testUserId = userRes.data[0].id;

  // Test 1.1: Create a task assigned to testUserId with statusA
  const taskTitle = `__B3_TEST_TASK_${Date.now()}`;
  const createTaskRes = await sql(`
    INSERT INTO tasks (project_id, title, status_id, status, assigned_to, priority)
    VALUES ('${projectId}', '${taskTitle}', '${statusA.id}', '${statusA.name}', '${testUserId}', 'medium')
    RETURNING id;
  `);

  if (!createTaskRes.ok || createTaskRes.data.length === 0) {
    fail("B3-1.1", "Could not create test task", JSON.stringify(createTaskRes.data));
    return;
  }
  const taskId = createTaskRes.data[0].id;

  // Check initial task_status_history record
  const h1 = await sql(`
    SELECT * FROM task_status_history
    WHERE task_id = '${taskId}' AND to_status_id = '${statusA.id}'
    ORDER BY changed_at DESC LIMIT 1;
  `);

  if (h1.ok && h1.data.length > 0 && h1.data[0].assigned_to_at_change === testUserId) {
    pass("B3-1.1", "Task creation recorded assigned_to_at_change in history", `assigned_to=${testUserId}`);
  } else {
    fail("B3-1.1", "Initial history record missing or assigned_to_at_change incorrect", JSON.stringify(h1.data));
  }

  // Test 1.2: Update status from statusA to statusB
  const updateStatusRes = await sql(`
    UPDATE tasks SET status_id = '${statusB.id}', status = '${statusB.name}'
    WHERE id = '${taskId}'
    RETURNING id;
  `);

  if (!updateStatusRes.ok) {
    fail("B3-1.2", "Could not update task status");
  } else {
    const h2 = await sql(`
      SELECT * FROM task_status_history
      WHERE task_id = '${taskId}' AND from_status_id = '${statusA.id}' AND to_status_id = '${statusB.id}'
      ORDER BY changed_at DESC LIMIT 1;
    `);

    if (h2.ok && h2.data.length > 0 && h2.data[0].assigned_to_at_change === testUserId) {
      pass("B3-1.2", "Status transition captured assigned_to_at_change at exact moment of change", `User A (${testUserId}) captured`);
    } else {
      fail("B3-1.2", "Status transition history missing assigned_to_at_change", JSON.stringify(h2.data));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. REASSIGNMENT ALGORITHM & ELIGIBILITY TESTS
  // ─────────────────────────────────────────────────────────────────────────
  section("2. REASSIGNMENT ALGORITHM & ELIGIBILITY");

  // Check function definition for eligibility guard and cross-project workload calculation
  const fnRes = await sql(`
    SELECT prosrc FROM pg_proc WHERE proname = 'run_automation_rules' LIMIT 1;
  `);

  if (fnRes.ok && fnRes.data.length > 0) {
    const src = fnRes.data[0].prosrc;
    const hasEligibilityCheck = src.includes("removed_at IS NULL") && src.includes("v_previous_owner");
    const hasCrossProjectWorkload = src.includes("SELECT COUNT(*)") && src.includes("ws.category != 'done'") && src.includes("retired IS FALSE");
    const hasTieBreaker = src.includes("pm.created_at ASC, pm.user_id ASC");

    if (hasEligibilityCheck) {
      pass("B3-2.1", "run_automation_rules includes eligibility check (removed_at IS NULL) for previous owner");
    } else {
      fail("B3-2.1", "run_automation_rules missing previous owner eligibility check");
    }

    if (hasCrossProjectWorkload) {
      pass("B3-2.2", "run_automation_rules calculates active task workload across ALL projects");
    } else {
      fail("B3-2.2", "run_automation_rules missing cross-project workload calculation");
    }

    if (hasTieBreaker) {
      pass("B3-2.3", "run_automation_rules includes deterministic tie-breaker (pm.created_at ASC, pm.user_id ASC)");
    } else {
      fail("B3-2.3", "run_automation_rules missing tie-breaker");
    }
  } else {
    fail("B3-2", "run_automation_rules function not found in DB");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. CLEANUP & REGRESSION TESTS
  // ─────────────────────────────────────────────────────────────────────────
  section("3. REGRESSION & COMPATIBILITY CHECKS");

  // Clean up test task
  await sql(`DELETE FROM tasks WHERE id = '${taskId}';`);
  console.log(`  🧹 Cleaned up test task "${taskTitle}"`);

  // Verify B1 and B2 triggers remain intact
  const trigRes = await sql(`
    SELECT DISTINCT trigger_name FROM information_schema.triggers
    WHERE event_object_table = 'tasks'
      AND event_object_schema = 'public'
      AND trigger_name IN ('trg_validate_task_status_transition', 'trg_record_task_status_history', 'trg_run_automation_on_status_change');
  `);

  if (trigRes.ok && trigRes.data.length === 3) {
    pass("B3-3.1", "All 3 core task status triggers active (validate, record_history, run_automation)");
  } else {
    fail("B3-3.1", "One or more core task status triggers missing", JSON.stringify(trigRes.data));
  }

  // Summary
  const total = passed + failed + skipped;
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                     TEST RESULTS SUMMARY                    ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log(`║  ✅ PASSED:  ${String(passed).padEnd(3)}  ❌ FAILED:  ${String(failed).padEnd(3)}  ⏭ SKIPPED: ${String(skipped).padEnd(3)}  Total: ${String(total).padEnd(3)} ║`);
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
