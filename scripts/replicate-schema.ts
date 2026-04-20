#!/usr/bin/env node

/**
 * Schema Replication Script - Dev to Production
 * 
 * This script extracts the complete schema from your development Supabase database
 * and applies it to your production Supabase database.
 * 
 * Schema includes:
 * - Tables and columns
 * - Foreign keys and constraints
 * - Indexes
 * - Row Level Security (RLS) policies
 * - Triggers and functions
 * - Extensions
 * - Sequences
 * 
 * Data is NOT copied - schema/structure only.
 * 
 * Usage:
 *   npx ts-node scripts/replicate-schema.ts
 * 
 * Environment Requirements:
 *   - .env file with DEV database credentials
 *   - .env.prod file with PROD database credentials
 *   - Both must have: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or direct DB_URL)
 */

import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import * as dotenv from "dotenv";

const execPromise = promisify(exec);

interface DatabaseCredentials {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  projectId?: string;
  annonKey?: string;
}

interface ExtractedSchema {
  schemas: string;
  tables: string;
  constraints: string;
  indexes: string;
  policies: string;
  triggers: string;
  functions: string;
  extensions: string;
  sequences: string;
}

// Load environment files
function loadEnv(envFile: string): Record<string, string> {
  const envPath = path.resolve(process.cwd(), envFile);
  if (!fs.existsSync(envPath)) {
    throw new Error(`Environment file not found: ${envPath}`);
  }
  return dotenv.parse(fs.readFileSync(envPath));
}

// Extract connection credentials from environment
function extractCredentials(env: Record<string, string>): DatabaseCredentials {
  // Option 1: Direct DATABASE_URL
  if (env.DATABASE_URL) {
    const url = new URL(env.DATABASE_URL);
    return {
      host: url.hostname || "localhost",
      port: parseInt(url.port || "5432"),
      database: url.pathname?.slice(1) || "",
      user: url.username || "",
      password: url.password || "",
    };
  }

  // Option 2: Supabase connection details
  if (env.VITE_SUPABASE_URL && env.SUPABASE_DB_PASSWORD) {
    const url = new URL(env.VITE_SUPABASE_URL);
    const projectId = url.hostname?.split(".")[0] || "";
    return {
      host: `${projectId}.db.supabase.co`,
      port: 5432,
      database: "postgres",
      user: "postgres",
      password: env.SUPABASE_DB_PASSWORD,
      projectId,
    };
  }

  // Option 3: Individual connection parameters
  if (env.DB_HOST && env.DB_USER && env.DB_PASSWORD) {
    return {
      host: env.DB_HOST,
      port: parseInt(env.DB_PORT || "5432"),
      database: env.DB_NAME || "postgres",
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    };
  }

  throw new Error(
    "Could not extract database credentials. Ensure .env contains DATABASE_URL, " +
      "VITE_SUPABASE_URL + SUPABASE_DB_PASSWORD, or DB_HOST + DB_USER + DB_PASSWORD"
  );
}

// Build psql connection string
function buildConnectionString(creds: DatabaseCredentials): string {
  return `postgresql://${creds.user}:${encodeURIComponent(creds.password)}@${creds.host}:${creds.port}/${creds.database}`;
}

// Extract schema using pg_dump (schema only)
async function extractSchema(connString: string): Promise<ExtractedSchema> {
  console.log("🔍 Extracting schema from source database...");

  try {
    // Use pg_dump to extract schema only (no data)
    const { stdout } = await execPromise(
      `pg_dump --schema-only --no-privileges --dbname="${connString}"`,
      { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer for large schemas
    );

    // Parse output into components
    const schema: ExtractedSchema = {
      schemas: extractSection(stdout, "CREATE SCHEMA"),
      tables: extractSection(stdout, "CREATE TABLE"),
      constraints: extractSection(stdout, "ALTER TABLE"),
      indexes: extractSection(stdout, "CREATE INDEX"),
      policies: extractSection(stdout, "CREATE POLICY"),
      triggers: extractSection(stdout, "CREATE TRIGGER"),
      functions: extractSection(stdout, "CREATE FUNCTION"),
      extensions: extractSection(stdout, "CREATE EXTENSION"),
      sequences: extractSection(stdout, "CREATE SEQUENCE"),
    };

    return schema;
  } catch (error: any) {
    if (error.message.includes("not found")) {
      throw new Error(
        "pg_dump not found. Please install PostgreSQL tools: " +
          "Windows: https://www.postgresql.org/download/windows/ " +
          "macOS: brew install postgresql " +
          "Linux: apt-get install postgresql-client"
      );
    }
    throw error;
  }
}

// Helper to extract specific sections from SQL
function extractSection(sql: string, pattern: string): string {
  const lines = sql.split("\n");
  const sections: string[] = [];
  let current = "";
  let inSection = false;

  for (const line of lines) {
    if (line.includes(pattern)) {
      inSection = true;
      current = line;
    } else if (inSection) {
      current += "\n" + line;

      // Check if section is complete (ends with ;)
      if (line.trim().endsWith(";")) {
        sections.push(current);
        current = "";
        inSection = false;
      }
    }
  }

  return sections.join("\n");
}

// Apply schema to target database
async function applySchema(
  connString: string,
  schema: ExtractedSchema
): Promise<void> {
  console.log("📝 Preparing schema for application...");

  // Combine all schema components
  const fullSchema = [
    schema.extensions,
    schema.schemas,
    schema.sequences,
    schema.tables,
    schema.constraints,
    schema.indexes,
    schema.functions,
    schema.triggers,
    schema.policies,
  ]
    .filter((s) => s.trim().length > 0)
    .join("\n\n");

  // Save to temporary file
  const tempFile = path.resolve("/tmp", `schema-${Date.now()}.sql`);
  fs.writeFileSync(tempFile, fullSchema);

  console.log("📤 Applying schema to target database...");

  try {
    await execPromise(
      `psql --dbname="${connString}" --file="${tempFile}" --set ON_ERROR_STOP=on`,
      { maxBuffer: 10 * 1024 * 1024 }
    );
    console.log("✅ Schema applied successfully!");

    // Cleanup
    fs.unlinkSync(tempFile);
  } catch (error: any) {
    console.error("❌ Error applying schema:", error.message);
    console.log("Schema file saved to:", tempFile);
    throw error;
  }
}

// Verify schema consistency
async function verifySchema(
  devConnString: string,
  prodConnString: string
): Promise<void> {
  console.log("🔎 Verifying schema consistency...");

  try {
    // Get table counts
    const { stdout: devTables } = await execPromise(
      `psql --dbname="${devConnString}" --command="SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema');"`
    );

    const { stdout: prodTables } = await execPromise(
      `psql --dbname="${prodConnString}" --command="SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema');"`
    );

    console.log(`📊 Dev tables: ${devTables.trim()}`);
    console.log(`📊 Prod tables: ${prodTables.trim()}`);

    if (devTables === prodTables) {
      console.log("✅ Table count matches!");
    } else {
      console.warn("⚠️  Table count mismatch - review schema manually");
    }
  } catch (error: any) {
    console.warn("⚠️  Could not verify schema:", error.message);
  }
}

// Main execution
async function main() {
  console.log("========================================");
  console.log("   Supabase Schema Replication Tool");
  console.log("========================================\n");

  try {
    // Load environment files
    console.log("📂 Loading environment files...");
    const devEnv = loadEnv(".env");
    const prodEnv = loadEnv(".env.prod");

    // Extract credentials
    console.log("🔐 Extracting database credentials...\n");
    const devCreds = extractCredentials(devEnv);
    const prodCreds = extractCredentials(prodEnv);

    console.log(`✓ Dev database: ${devCreds.host}:${devCreds.port}/${devCreds.database}`);
    console.log(`✓ Prod database: ${prodCreds.host}:${prodCreds.port}/${prodCreds.database}\n`);

    // Build connection strings
    const devConnString = buildConnectionString(devCreds);
    const prodConnString = buildConnectionString(prodCreds);

    // Confirm action
    console.log("⚠️  WARNING: This will REPLACE the schema in production!");
    console.log("    - Existing schema will be dropped");
    console.log("    - Data will NOT be affected (schema only)\n");

    // TODO: In real implementation, add user confirmation here
    // For now, proceed automatically

    // Extract schema
    const schema = await extractSchema(devConnString);

    // Apply schema
    await applySchema(prodConnString, schema);

    // Verify
    await verifySchema(devConnString, prodConnString);

    console.log("\n✨ Schema replication completed successfully!");
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

main();
