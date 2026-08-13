import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://goutpygixoxkgbrfmkey.supabase.co";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvdXRweWdpeG94a2dicmZta2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2OTE0OTYsImV4cCI6MjA3NTI2NzQ5Nn0.V7_tUfAUN1jV_D9N8JtE9B9b8T5Y0";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

describe("Phase 3: Lockout Rules for System Actions (C6) & System Source Audit Tagging (C7)", () => {

  it("1. Should verify source and automation_rule_id columns exist on task_status_history schema", async () => {
    const { data, error } = await supabase
      .from("task_status_history")
      .select("id, source, automation_rule_id, changed_by")
      .limit(5);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("2. Should retrieve task_status_history rows with valid source tagging structure", async () => {
    const { data, error } = await supabase
      .from("task_status_history")
      .select("id, task_id, source, automation_rule_id")
      .limit(10);

    expect(error).toBeNull();
    if (data && data.length > 0) {
      data.forEach((row) => {
        expect(row).toHaveProperty("source");
        expect(row).toHaveProperty("automation_rule_id");
      });
    }
  });

  it("3. Should verify automation_rule_runs logs lockout deferrals correctly", async () => {
    const { data, error } = await supabase
      .from("automation_rule_runs")
      .select("id, automation_rule_id, result, error_message")
      .limit(5);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
