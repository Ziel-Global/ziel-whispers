export const TARGET_PROJECT_ID = "goutpygixoxkgbrfmkey";
export const TARGET_SUPABASE_URL = "https://goutpygixoxkgbrfmkey.supabase.co";

export const WORKFLOW_TEMPLATE_ID = "1c631b59-3fa8-4b46-bc64-c7494dc2a648"; // Standard template

export const STATUS_UNLINKED = "e1bcd6b1-0325-43f8-a64d-bf6d4addcde5";
export const STATUS_DEVELOPMENT = "fe95d045-49db-48b6-924b-803a57b7c4c6";
export const STATUS_QA_REVIEW = "08446746-700d-4663-a584-646fba32e3c5";
export const STATUS_DONE = "a5034372-f520-4341-a8f7-f9d635f46683";

export const USER_DEV_SAAD = "8100e324-88a4-451d-82f5-84d1ecb9ccde"; // Saad Nasir
export const USER_QA_SHAHID = "51e1279f-bbd0-448e-b928-d7cca20b9f73"; // Shahid
export const USER_PM_SAMI = "beaa51f7-3271-40f5-a30f-7861416b63c5"; // Muhammad Sami Khan

export function assertTargetEnvironment(url?: string) {
  const currentUrl = url || process.env.VITE_SUPABASE_URL || "";
  if (!currentUrl.includes(TARGET_PROJECT_ID)) {
    throw new Error(
      `REFUSING TO EXECUTE TEST SUITE: Environment URL "${currentUrl}" does not match DEV project "${TARGET_PROJECT_ID}".`
    );
  }
}
