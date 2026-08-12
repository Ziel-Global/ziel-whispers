import { exec } from "child_process";
import { promisify } from "util";
import { assertTargetEnvironment } from "../setup/constants";

const execPromise = promisify(exec);

export async function dbQuery<T = any>(sql: string): Promise<T[]> {
  assertTargetEnvironment();

  // Normalize multiline SQL into single-line and escape double quotes for CLI execution
  const singleLineSql = sql
    .replace(/[\r\n]+/g, " ")
    .replace(/"/g, '\\"')
    .trim();
  const command = `npx supabase db query "${singleLineSql}" --linked`;

  try {
    const { stdout } = await execPromise(command, { cwd: process.cwd() });

    // Parse json response from supabase CLI
    const jsonMatch = stdout.match(
      /\{[\s\S]*"rows"\s*:\s*\[[\s\S]*\][\s\S]*\}/,
    );
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return (parsed.rows || []) as T[];
    }

    // Check if it's empty rows
    const emptyRowsMatch = stdout.match(
      /\{[\s\S]*"rows"\s*:\s*\[\s*\][\s\S]*\}/,
    );
    if (emptyRowsMatch) {
      return [];
    }

    return [];
  } catch (error: any) {
    console.error(
      `[dbQuery Error] Execution failed for SQL:\n${singleLineSql}\nError: ${error.message}`,
    );
    throw error;
  }
}
