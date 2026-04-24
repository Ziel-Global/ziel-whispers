import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://jjgdpnociwltzcukbrft.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "your_key_here"; 

// Wait, I can just grep the .env file to get the keys.
