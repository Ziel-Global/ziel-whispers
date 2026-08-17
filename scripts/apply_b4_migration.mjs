/**
 * B4 Migration Application Script
 * Applies 20270815000000_b4_automation_chain_depth.sql via Supabase Management API
 * Run: node scripts/apply_b4_migration.mjs
 */

import { readFileSync } from "fs";


const SQL = readFileSync("supabase/migrations/20270815000000_b4_automation_chain_depth.sql", "utf8");

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

  console.log(`✓ ${label} SUCCESS`);
  return true;
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  B4 Migration Application: Chain-Depth Protection");
  console.log("  Project:", PROJECT_REF);
  console.log("═══════════════════════════════════════════════════");

  const ok = await runSQL(SQL, "B4 Migration Update");
  if (!ok) {
    console.error("❌ B4 Migration Failed");
    process.exit(1);
  }

  console.log("\n✅ B4 Migration Applied Successfully!\n");
}

main();
