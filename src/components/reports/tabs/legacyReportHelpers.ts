import html2canvas from "html2canvas";
import { eachDayOfInterval } from "date-fns";

export function humanizeCategory(cat: string) {
  return cat
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export type UtilStatus = "High" | "Healthy" | "Watch" | "Low";

export function utilStatusFromPct(pct: number): UtilStatus {
  if (pct >= 90) return "High";
  if (pct >= 70) return "Healthy";
  if (pct >= 55) return "Watch";
  return "Low";
}

export function utilStatusBadgeClass(status: UtilStatus) {
  switch (status) {
    case "High":
      return "bg-[#DFF6E4] text-[#1B8A46] border-0 shadow-none";
    case "Healthy":
      return "bg-[#EAF3FF] text-[#1C6FC9] border-0 shadow-none";
    case "Watch":
      return "bg-[#FDF3E3] text-[#A9720B] border-0 shadow-none";
    default:
      return "bg-[#FDECEC] text-[#C23A3A] border-0 shadow-none";
  }
}

export function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export function exportCSV(rows: Record<string, any>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

export async function exportPNG(ref: React.RefObject<HTMLDivElement>, filename: string) {
  if (!ref.current) return;
  const canvas = await html2canvas(ref.current, { backgroundColor: "#ffffff" });
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
}

export function getWorkingDays(start: Date, end: Date, workWeek: number = 5) {
  return eachDayOfInterval({ start, end }).filter((d) => {
    const day = d.getDay();
    return day !== 0 && (day !== 6 || workWeek === 6);
  }).length;
}

export function smoothPath(points: { x: number; y: number }[], tension = 1): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    const [a, b] = points;
    const dx = (b.x - a.x) / 3;
    return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} C${(a.x + dx).toFixed(1)} ${a.y.toFixed(1)} ${(b.x - dx).toFixed(1)} ${b.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  const t = 6 / Math.max(0.5, tension);
  let d = `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / t;
    const cp1y = p1.y + (p2.y - p0.y) / t;
    const cp2x = p2.x - (p3.x - p1.x) / t;
    const cp2y = p2.y - (p3.y - p1.y) / t;
    d += ` C${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}
