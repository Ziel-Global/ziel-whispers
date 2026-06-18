import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/integrations/supabase/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const avatarCacheBuster = Date.now();

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function getAvatarUrl(path: string | null | undefined) {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?t=${avatarCacheBuster}`;
}

export const MISC_PROJECT_ID = "__misc__";

export function getProjectName(log: any): string {
  return log.projects?.name || "Miscellaneous";
}

export function formatHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export function getLeaveTypeName(r: any) {
  if (!r) return "";
  if (r.hours) {
    return `Hourly Leave — ${r.hours} hours`;
  }
  return r.reason?.split(":")[0]?.split(" - ")[0] || r.leave_types?.name || "Annual";
}

export function getCurrentLeaveYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startYear = month >= 5 ? year : year - 1;
  return {
    startYear,
    start: `${startYear}-06-01`,
    end: `${startYear + 1}-05-31`,
    label: `June ${startYear} \u2014 May ${startYear + 1}`,
  };
}

export function getLeaveYearRange(startYear: number) {
  return {
    startYear,
    start: `${startYear}-06-01`,
    end: `${startYear + 1}-05-31`,
    label: `June ${startYear} \u2014 May ${startYear + 1}`,
  };
}

export function getLeaveYearOptions() {
  const current = getCurrentLeaveYear();
  const options = [];
  for (let i = 2; i >= 0; i--) {
    const year = current.startYear - i;
    options.push(getLeaveYearRange(year));
  }
  return options;
}

