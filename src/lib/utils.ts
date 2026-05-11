import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/integrations/supabase/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAvatarUrl(path: string | null | undefined) {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // Add a cache-busting timestamp to ensure updates are reflected immediately
  return `${data.publicUrl}?t=${new Date().getTime()}`;
}

