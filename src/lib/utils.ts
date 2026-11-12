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

// Whole numbers stay whole (25); decimals are cut (not rounded) to exactly 2 digits (25.3999 -> 25.39)
export function formatDecimal(n: number) {
  if (Number.isInteger(n)) return String(n);
  return (Math.trunc(n * 100) / 100).toFixed(2);
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


export function isRichHtml(str: string | null | undefined): boolean {
  if (!str) return false;
  return /<(p|div|br|strong|b|em|i|u|s|strike|del|code|pre|ul|ol|li|blockquote|h[1-6]|a|img|hr|span|input)\b/i.test(str);
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  const hasImg = /<img\b/i.test(html);
  const text = html
    .replace(/<(br|hr)\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!text && hasImg) return "[Image]";
  return text;
}

export function getPlainTextLength(html: string | null | undefined): number {
  if (!html) return 0;
  if (!isRichHtml(html)) return html.length;
  const plain = html
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
  return plain.length;
}

export function hasRichContent(html: string | null | undefined): boolean {
  if (!html) return false;
  if (/<img\b/i.test(html)) return true;
  return getPlainTextLength(html) > 0;
}

export const truncateWords = (str: string | null | undefined, n: number) => {
  if (!str) return null;
  const clean = isRichHtml(str) ? stripHtml(str) : str;
  if (!clean) return null;
  const words = clean.split(/\s+/);
  if (words.length <= n) return clean;
  return words.slice(0, n).join(" ") + "...";
};

export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return "?";
  return (
    name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  );
}

