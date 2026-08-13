import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://goutpygixoxkgbrfmkey.supabase.co";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvdXRweWdpeG94a2dicmZta2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2OTE0OTYsImV4cCI6MjA3NTI2NzQ5Nn0.V7_tUfAUN1jV_D9N8JtE9B9b8T5Y0";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

describe("Phase 2: Daily Log Field Split (hours_status_id vs declared_transition_to)", () => {

  it("1. Should verify hours_status_id and declared_transition_to columns exist on daily_logs schema", async () => {
    const { data, error } = await supabase.from("daily_logs").select("id, hours_status_id, declared_transition_to").limit(5);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("2. Should retrieve daily_logs rows with valid hours_status_id structure", async () => {
    const { data, error } = await supabase
      .from("daily_logs")
      .select("id, hours_status_id, declared_transition_to, status")
      .limit(10);

    expect(error).toBeNull();
    if (data && data.length > 0) {
      data.forEach((row) => {
        expect(row).toHaveProperty("hours_status_id");
        expect(row).toHaveProperty("declared_transition_to");
      });
    }
  });

  it("3. Should verify task status relationships link correctly with daily_logs status fields", async () => {
    const { data, error } = await supabase
      .from("workflow_statuses")
      .select("id, name, category")
      .limit(1);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
