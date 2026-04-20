/**
 * Database Utility - Schema & Environment Management
 * 
 * Programmatic access to Supabase database operations
 * Can be imported and used in your Node.js scripts or applications
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

interface DatabaseConfig {
  url: string;
  key: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

interface SchemaStats {
  tables: number;
  indexes: number;
  triggers: number;
  functions: number;
  policies: number;
}

/**
 * Load database configuration from environment file
 */
export function loadDatabaseConfig(envFile: string = ".env"): DatabaseConfig {
  const envPath = path.resolve(process.cwd(), envFile);

  if (!fs.existsSync(envPath)) {
    throw new Error(`Environment file not found: ${envPath}`);
  }

  const env = dotenv.parse(fs.readFileSync(envPath));

  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment"
    );
  }

  // Extract host from URL
  const urlObj = new URL(url);
  const host = urlObj.hostname || "";
  const projectId = host.split(".")[0];

  return {
    url,
    key,
    host,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: env.SUPABASE_DB_PASSWORD || env.DB_PASSWORD || "",
  };
}

/**
 * Build PostgreSQL connection string
 */
export function buildConnectionString(config: DatabaseConfig): string {
  const password = encodeURIComponent(config.password);
  return `postgresql://${config.user}:${password}@${config.host}:${config.port}/${config.database}`;
}

/**
 * Create Supabase client for API operations
 */
export function createSupabaseClient(config: DatabaseConfig) {
  return createClient(config.url, config.key);
}

/**
 * Get schema statistics from a database
 */
export async function getSchemaStats(
  connectionString: string
): Promise<SchemaStats> {
  const queries = {
    tables: `SELECT count(*) as count FROM information_schema.tables 
             WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'extensions')`,
    indexes: `SELECT count(*) as count FROM information_schema.statistics 
              WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`,
    triggers: `SELECT count(*) as count FROM information_schema.triggers 
               WHERE trigger_schema NOT IN ('pg_catalog', 'information_schema')`,
    functions: `SELECT count(*) as count FROM information_schema.routines 
                WHERE routine_schema = 'public'`,
    policies: `SELECT count(*) as count FROM pg_policies WHERE schemaname = 'public'`,
  };

  const stats: SchemaStats = {
    tables: 0,
    indexes: 0,
    triggers: 0,
    functions: 0,
    policies: 0,
  };

  try {
    for (const [key, query] of Object.entries(queries)) {
      const { stdout } = await execPromise(
        `psql --dbname="${connectionString}" --command="${query}" -t`
      );
      stats[key as keyof SchemaStats] = parseInt(stdout.trim().split("\n")[0]);
    }
  } catch (error) {
    console.warn("Could not fetch schema stats:", error);
  }

  return stats;
}

/**
 * List all tables in schema
 */
export async function listTables(
  connectionString: string
): Promise<string[]> {
  const query = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;

  try {
    const { stdout } = await execPromise(
      `psql --dbname="${connectionString}" --command="${query}" -t`
    );
    return stdout
      .trim()
      .split("\n")
      .filter((name) => name.trim().length > 0);
  } catch (error) {
    throw new Error(`Failed to list tables: ${error}`);
  }
}

/**
 * Extract schema from database
 */
export async function extractSchema(
  connectionString: string,
  outputFile?: string
): Promise<string> {
  console.log("🔍 Extracting schema...");

  try {
    const { stdout } = await execPromise(
      `pg_dump --schema-only --no-privileges --no-owner --dbname="${connectionString}"`,
      { maxBuffer: 50 * 1024 * 1024 } // 50MB buffer
    );

    if (outputFile) {
      fs.writeFileSync(outputFile, stdout);
      console.log(`✅ Schema extracted to: ${outputFile}`);
    }

    return stdout;
  } catch (error) {
    throw new Error(`Failed to extract schema: ${error}`);
  }
}

/**
 * Apply schema to database
 */
export async function applySchema(
  connectionString: string,
  schemaSql: string
): Promise<void> {
  console.log("📤 Applying schema...");

  const tempFile = `/tmp/schema-${Date.now()}.sql`;

  try {
    fs.writeFileSync(tempFile, schemaSql);

    await execPromise(
      `psql --dbname="${connectionString}" --file="${tempFile}" --set ON_ERROR_STOP=on --output=/dev/null`,
      { maxBuffer: 50 * 1024 * 1024 }
    );

    console.log("✅ Schema applied successfully");
    fs.unlinkSync(tempFile);
  } catch (error) {
    console.error("Error applying schema:", error);
    console.log("Schema file saved to:", tempFile);
    throw error;
  }
}

/**
 * Compare schemas between two databases
 */
export async function compareSchemas(
  devConnectionString: string,
  prodConnectionString: string
): Promise<{
  devStats: SchemaStats;
  prodStats: SchemaStats;
  match: boolean;
}> {
  console.log("🔎 Comparing schemas...");

  const devStats = await getSchemaStats(devConnectionString);
  const prodStats = await getSchemaStats(prodConnectionString);

  const match =
    devStats.tables === prodStats.tables &&
    devStats.indexes === prodStats.indexes &&
    devStats.triggers === prodStats.triggers &&
    devStats.functions === prodStats.functions &&
    devStats.policies === prodStats.policies;

  return { devStats, prodStats, match };
}

/**
 * Full schema replication from dev to prod
 */
export async function replicateSchema(
  devConnectionString: string,
  prodConnectionString: string,
  options: {
    dryRun?: boolean;
    backup?: boolean;
    verify?: boolean;
  } = {}
): Promise<void> {
  const { dryRun = false, backup = true, verify = true } = options;

  console.log("🚀 Starting schema replication...\n");

  try {
    // Step 1: Extract
    const schema = await extractSchema(devConnectionString);

    if (dryRun) {
      console.log("📋 Dry run - schema extracted but not applied");
      console.log(`Schema size: ${(schema.length / 1024).toFixed(2)} KB`);
      return;
    }

    // Step 2: Backup
    if (backup) {
      const backupFile = `schema-backup-prod-${Date.now()}.sql`;
      await extractSchema(prodConnectionString, backupFile);
      console.log(`📦 Backup created: ${backupFile}\n`);
    }

    // Step 3: Apply
    await applySchema(prodConnectionString, schema);

    // Step 4: Verify
    if (verify) {
      console.log("");
      const comparison = await compareSchemas(
        devConnectionString,
        prodConnectionString
      );

      console.log("📊 Schema comparison:");
      console.log(
        `  Tables: dev=${comparison.devStats.tables}, prod=${comparison.prodStats.tables}`
      );
      console.log(
        `  Indexes: dev=${comparison.devStats.indexes}, prod=${comparison.prodStats.indexes}`
      );
      console.log(
        `  Functions: dev=${comparison.devStats.functions}, prod=${comparison.prodStats.functions}`
      );
      console.log(
        `  Triggers: dev=${comparison.devStats.triggers}, prod=${comparison.prodStats.triggers}`
      );
      console.log(
        `  Policies: dev=${comparison.devStats.policies}, prod=${comparison.prodStats.policies}`
      );

      if (comparison.match) {
        console.log("\n✅ Schemas match perfectly!");
      } else {
        console.warn("\n⚠️  Warning: Schemas may differ - manual review recommended");
      }
    }

    console.log("\n✨ Schema replication completed!");
  } catch (error) {
    console.error("\n❌ Error during replication:", error);
    throw error;
  }
}

/**
 * Create a test connection
 */
export async function testConnection(
  connectionString: string
): Promise<boolean> {
  try {
    const { stdout } = await execPromise(
      `psql --dbname="${connectionString}" --command="SELECT version();" -t`
    );
    console.log("✅ Connection successful");
    return true;
  } catch (error) {
    console.error("❌ Connection failed:", error);
    return false;
  }
}

// Example usage / CLI execution
if (require.main === module) {
  const command = process.argv[2];

  (async () => {
    try {
      const devConfig = loadDatabaseConfig(".env");
      const prodConfig = loadDatabaseConfig(".env.prod");

      const devConnStr = buildConnectionString(devConfig);
      const prodConnStr = buildConnectionString(prodConfig);

      switch (command) {
        case "test":
          console.log("Testing dev connection...");
          await testConnection(devConnStr);
          console.log("Testing prod connection...");
          await testConnection(prodConnStr);
          break;

        case "stats":
          console.log("Dev schema stats:");
          console.log(await getSchemaStats(devConnStr));
          console.log("\nProd schema stats:");
          console.log(await getSchemaStats(prodConnStr));
          break;

        case "compare":
          const comparison = await compareSchemas(devConnStr, prodConnStr);
          console.log(JSON.stringify(comparison, null, 2));
          break;

        case "extract":
          await extractSchema(
            devConnStr,
            `schema-dev-${Date.now()}.sql`
          );
          break;

        case "replicate":
          await replicateSchema(devConnStr, prodConnStr, {
            backup: true,
            verify: true,
          });
          break;

        case "replicate:dry-run":
          await replicateSchema(devConnStr, prodConnStr, {
            dryRun: true,
          });
          break;

        default:
          console.log("Usage: npx ts-node src/lib/database-util.ts [command]");
          console.log("\nCommands:");
          console.log("  test              - Test connections to both databases");
          console.log("  stats             - Show schema statistics");
          console.log("  compare           - Compare schemas between dev and prod");
          console.log("  extract           - Extract dev schema to file");
          console.log("  replicate         - Full replication dev → prod");
          console.log("  replicate:dry-run - Test replication without applying");
      }
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  })();
}

export default {
  loadDatabaseConfig,
  buildConnectionString,
  createSupabaseClient,
  getSchemaStats,
  listTables,
  extractSchema,
  applySchema,
  compareSchemas,
  replicateSchema,
  testConnection,
};
