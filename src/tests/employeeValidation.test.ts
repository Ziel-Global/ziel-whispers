import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { adminSchema, clientEditSchema } from "@/hooks/useEmployeeProfileData";

const validAdminEmployee = {
  full_name: "Amina Khan",
  email: "amina@example.com",
  phone: "03001234567",
  designation: "QA Engineer",
  department: "SQA",
  join_date: "2026-01-01",
  employment_type: "full-time",
  role: "employee",
  shift_start: "09:00",
  shift_end: "17:00",
  reminder_offset_minutes: 15,
  is_night_shift: false,
  working_days: 5,
  overtime_enabled: false,
};

describe("employee profile validation", () => {
  it("accepts a valid employee profile", () => {
    expect(adminSchema.safeParse(validAdminEmployee).success).toBe(true);
  });

  it("rejects invalid email, phone, and working-day settings", () => {
    expect(adminSchema.safeParse({ ...validAdminEmployee, email: "not-an-email" }).success).toBe(false);
    const phoneResult = adminSchema.safeParse({ ...validAdminEmployee, phone: "12345" });
    expect(phoneResult.success).toBe(false);
    if (!phoneResult.success) {
      expect(phoneResult.error.issues.some((issue) => issue.message.includes("Pakistani phone number"))).toBe(true);
    }
    expect(adminSchema.safeParse({ ...validAdminEmployee, working_days: 7 }).success).toBe(false);
  });

  it("accepts valid client-member details and optional project assignments", () => {
    expect(clientEditSchema.safeParse({
      full_name: "Amina Khan",
      email: "amina@example.com",
      project_ids: ["project-1"],
    }).success).toBe(true);
  });

  it("rejects malformed names, emails, and whitespace in an email", () => {
    expect(clientEditSchema.safeParse({ full_name: "AB", email: "amina@example.com" }).success).toBe(false);
    expect(clientEditSchema.safeParse({ full_name: "Amina2", email: "amina@example.com" }).success).toBe(false);
    expect(clientEditSchema.safeParse({ full_name: "Amina Khan", email: "amina @example.com" }).success).toBe(false);
  });
});
