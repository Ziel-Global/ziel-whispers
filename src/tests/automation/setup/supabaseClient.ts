import { createClient } from "@supabase/supabase-js";
import { assertTargetEnvironment, TARGET_SUPABASE_URL } from "./constants";

const url =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  TARGET_SUPABASE_URL;

const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!key) {
  throw new Error(
    "Missing Supabase Key. Please define SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY in your environment variables.",
  );
}

assertTargetEnvironment(url);

export const supabase = createClient(url, key);
