#!/usr/bin/env node

/**
 * Schema Replication Using Supabase CLI
 * 
 * This is the RECOMMENDED approach as it's built specifically for Supabase.
 * 
 * Features:
 * - Uses Supabase CLI (already installed in most projects)
 * - Handles all schema objects automatically
 * - Preserves RLS policies, triggers, functions, etc.
 * - Safe and reversible via migrations
 * 
 * Prerequisites:
 *   npm install -g supabase
 *   # or: bunx supabase (if using bun)
 */

import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

interface SupabaseConfig {
  devProjectId: string;
  devAccessToken: string;
  prodProjectId: string;
  prodAccessToken: string;
}

// Extract Supabase config from environment
function loadSupabaseConfig(): SupabaseConfig {
  const envPath = path.resolve(process.cwd(), ".env");
  const envProdPath = path.resolve(process.cwd(), ".env.prod");

  if (!fs.existsSync(envPath) || !fs.existsSync(envProdPath)) {
    throw new Error("Missing .env or .env.prod files");
  }

  const envContent = fs.readFileSync(envPath, "utf-8");
  const envProdContent = fs.readFileSync(envProdPath, "utf-8");

  // Extract project IDs from URLs
  const devMatch = envContent.match(
    /VITE_SUPABASE_URL=https:\/\/([a-z0-9-]+)\.supabase\.co/
  );
  const prodMatch = envProdContent.match(
    /VITE_SUPABASE_URL=https:\/\/([a-z0-9-]+)\.supabase\.co/
  );

  if (!devMatch || !prodMatch) {
    throw new Error(
      "Could not extract project IDs from environment URLs. " +
        "Ensure VITE_SUPABASE_URL is set in both .env files"
    );
  }

  return {
    devProjectId: devMatch[1],
    prodProjectId: prodMatch[1],
    devAccessToken: process.env.SUPABASE_ACCESS_TOKEN_DEV || "",
    prodAccessToken: process.env.SUPABASE_ACCESS_TOKEN_PROD || "",
  };
}

// Check if Supabase CLI is installed
async function checkSupabaseCliInstalled(): Promise<void> {
  try {
    await execPromise("supabase --version");
  } catch {
    throw new Error(
      "Supabase CLI is not installed. Install it with: npm install -g supabase"
    );
  }
}

// Pull schema from dev as a new migration
async function pullDevSchema(config: SupabaseConfig): Promise<void> {
  console.log(`📥 Pulling schema from dev project (${config.devProjectId})...`);

  // Note: Supabase CLI uses local directory
  // This assumes you want to create a migration file
  console.log(
    "ℹ️  Note: Ensure you're in the project directory with supabase/config.toml"
  );
  console.log(
    "ℹ️  The migration will be saved to supabase/migrations/\n"
  );

  // Supabase CLI doesn't have a direct "pull schema" command
  // Instead, we'll use the migration workflow
  console.log("Using 'supabase db pull' to generate a migration...");

  try {
    await execPromise(
      `supabase db pull --local --linked`,
      { cwd: process.cwd() }
    );
    console.log("✅ Schema pulled successfully!");
  } catch (error: any) {
    if (
      error.message.includes("not linked") ||
      error.message.includes("not authenticated")
    ) {
      throw new Error(
        `Project not linked. Run: supabase link --project-ref ${config.devProjectId}`
      );
    }
    throw error;
  }
}

// Apply schema to production
async function applySchemaToProduction(
  config: SupabaseConfig
): Promise<void> {
  console.log(
    `📤 Applying schema to production project (${config.prodProjectId})...`
  );

  // Step 1: Link to production project
  console.log("\n1️⃣  Linking to production project...");
  try {
    await execPromise(
      `supabase link --project-ref ${config.prodProjectId}`,
      { cwd: process.cwd() }
    );
  } catch (error: any) {
    if (!error.message.includes("already linked")) {
      throw error;
    }
    console.log("✓ Already linked to production");
  }

  // Step 2: Push migrations
  console.log("\n2️⃣  Pushing migrations to production...");
  try {
    await execPromise(`supabase db push`, {
      cwd: process.cwd(),
    });
    console.log("✅ Migrations applied to production!");
  } catch (error: any) {
    throw new Error(`Failed to push to production: ${error.message}`);
  }
}

// Alternative: Use pg_dump directly
async function pushUsingPgDump(
  devUrl: string,
  prodUrl: string
): Promise<void> {
  console.log(
    "Using pg_dump method for direct schema transfer (PostgreSQL required)...\n"
  );

  console.log("🔍 Extracting schema from dev...");
  const { stdout: schema } = await execPromise(
    `pg_dump --schema-only --no-privileges --dbname="${devUrl}"`,
    { maxBuffer: 10 * 1024 * 1024 }
  );

  console.log("📝 Applying schema to prod...");
  const tempFile = `/tmp/schema-${Date.now()}.sql`;
  fs.writeFileSync(tempFile, schema);

  try {
    await execPromise(
      `psql --dbname="${prodUrl}" --file="${tempFile}" --set ON_ERROR_STOP=on`,
      { maxBuffer: 10 * 1024 * 1024 }
    );
    console.log("✅ Schema applied successfully!");
    fs.unlinkSync(tempFile);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.log("Schema file saved to:", tempFile);
    throw error;
  }
}

// Main
async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Supabase Schema Replication (CLI Method)");
  console.log("═══════════════════════════════════════════\n");

  try {
    await checkSupabaseCliInstalled();

    console.log("ℹ️  Method: Using Supabase CLI\n");

    console.log(
      "This approach will guide you through the Supabase migration workflow:\n"
    );
    console.log("1. Pull current schema from dev as a new migration");
    console.log("2. Review the migration (optional)");
    console.log("3. Push migration to production\n");

    console.log("Prerequisites:");
    console.log("  ✓ Supabase projects linked in supabase/config.toml");
    console.log("  ✓ Valid access tokens if needed\n");

    // In a real implementation, this would be interactive
    // For now, provide instructions
    console.log(
      "To execute this workflow, run these commands in your terminal:\n"
    );

    console.log("# 1. Link to your dev project (if not already linked)");
    console.log(
      "supabase link --project-ref <your-dev-project-id> --password <dev-db-password>\n"
    );

    console.log("# 2. Pull schema as a migration");
    console.log("supabase db pull\n");

    console.log("# 3. Review the generated migration in supabase/migrations/");
    console.log("cat supabase/migrations/$(ls -t supabase/migrations | head -1)\n");

    console.log("# 4. Push to production");
    console.log(
      "supabase link --project-ref <your-prod-project-id> --password <prod-db-password>"
    );
    console.log("supabase db push\n");

    console.log("For more info: https://supabase.com/docs/guides/cli/managing-schemas");
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
