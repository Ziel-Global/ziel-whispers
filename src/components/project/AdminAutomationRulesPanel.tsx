import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TRIGGERS = [
  { value: "status_change", label: "Status Change" },
  { value: "blocker_raised", label: "Blocker Raised" },
  { value: "blocker_resolved", label: "Blocker Resolved" },
  { value: "scheduled", label: "Scheduled" },
] as const;

function triggerLabel(type: string) {
  return TRIGGERS.find((t) => t.value === type)?.label || type.replace(/_/g, " ");
}

function statusPill(status: string) {
  if (status === "enabled") return { label: "Enabled", bg: "#DFF6E4", color: "#1B8A46" };
  if (status === "draft") return { label: "Draft", bg: "#FDF3E3", color: "#A9720B" };
  return { label: "Disabled", bg: "#F6F5F3", color: "#6B6B72" };
}

type Props = {
  automationRules: any[];
  openAddRule: () => void;
  openEditRule: (rule: any) => void;
  toggleRuleStatus: (id: string, checked: boolean) => void;
  setDeleteRuleConfirmId: (id: string | null) => void;
};

export function AdminAutomationRulesPanel({
  automationRules,
  openAddRule,
  openEditRule,
  toggleRuleStatus,
  setDeleteRuleConfirmId,
}: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [triggerFilter, setTriggerFilter] = useState("all");
  const [sort, setSort] = useState<"priority" | "recent">("priority");

  const filtered = useMemo(() => {
    let list = [...(automationRules || [])];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          (r.name || "").toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (triggerFilter !== "all") {
      list = list.filter((r) => r.trigger_type === triggerFilter);
    }
    if (sort === "priority") {
      list.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
    } else {
      list.sort((a, b) => {
        const da = a.updated_at || a.created_at || "";
        const db = b.updated_at || b.created_at || "";
        return db.localeCompare(da);
      });
    }
    return list;
  }, [automationRules, search, statusFilter, triggerFilter, sort]);

  const total = automationRules?.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2.5">
        <div>
          <div className="text-[18px] font-bold text-[#17171A]">Rules</div>
          <div className="text-[12.5px] text-[#8B8B92] mt-1">
            {total} rule{total === 1 ? "" : "s"}
          </div>
        </div>
        <button
          type="button"
          onClick={openAddRule}
          className="inline-flex items-center gap-[7px] bg-[#EB5A1E] text-white font-semibold text-[13px] px-4 py-[9px] rounded-[10px] hover:bg-[#d64f18] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
          Add Rule
        </button>
      </div>

      {total > 1 && (
        <div className="bg-white border border-black/[0.08] rounded-[14px] px-4 py-3 flex flex-wrap items-center gap-2.5">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rules…"
            className="h-9 w-[200px] rounded-[10px] border-black/10 text-[13px] bg-[#F6F5F3] shadow-none"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[130px] rounded-[10px] border-black/10 text-[13px] shadow-none">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="enabled">Enabled</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
          <Select value={triggerFilter} onValueChange={setTriggerFilter}>
            <SelectTrigger className="h-9 w-[160px] rounded-[10px] border-black/10 text-[13px] shadow-none">
              <SelectValue placeholder="Trigger" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All triggers</SelectItem>
              {TRIGGERS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as "priority" | "recent")}>
            <SelectTrigger className="h-9 w-[130px] rounded-[10px] border-black/10 text-[13px] shadow-none">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="recent">Recent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {total === 0 ? (
        <div className="bg-white border border-black/[0.08] rounded-[14px] py-14 px-6 text-center">
          <div className="text-[15px] font-bold text-[#17171A] mb-1.5">No automation rules yet</div>
          <p className="text-[13px] text-[#8B8B92] mb-5 max-w-sm mx-auto">
            Create rules to automate project workflows when status changes or blockers are raised.
          </p>
          <button
            type="button"
            onClick={openAddRule}
            className="inline-flex items-center gap-[7px] bg-[#EB5A1E] text-white font-semibold text-[13px] px-4 py-[9px] rounded-[10px] hover:bg-[#d64f18] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
            Create Your First Rule
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-black/[0.08] rounded-[14px] py-10 text-center text-[13px] text-[#8B8B92]">
          No rules match your filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rule: any) => {
            const pill = statusPill(rule.status);
            return (
              <div
                key={rule.id}
                className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] flex items-start justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <div className="text-[14.5px] font-bold text-[#17171A]">{rule.name}</div>
                    <span
                      className="text-[11px] font-bold px-[9px] py-[3px] rounded-full"
                      style={{ background: "#E6E9FF", color: "#4C57D9" }}
                    >
                      {triggerLabel(rule.trigger_type)}
                    </span>
                    <span
                      className="text-[11px] font-bold px-[9px] py-[3px] rounded-full"
                      style={{ background: pill.bg, color: pill.color }}
                    >
                      {pill.label}
                    </span>
                  </div>
                  {rule.description && (
                    <p className="text-[12.5px] text-[#8B8B92] mb-1.5 line-clamp-2">{rule.description}</p>
                  )}
                  <div className="text-[12px] text-[#8B8B92]">
                    Priority: {rule.priority} ·{" "}
                    {rule.allow_triggering_other_rules ? "Chainable" : "No chaining"}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={rule.status === "enabled"}
                    onCheckedChange={(c) => toggleRuleStatus(rule.id, c)}
                    className="data-[state=checked]:bg-[#EB5A1E]"
                  />
                  <button
                    type="button"
                    onClick={() => openEditRule(rule)}
                    className="w-[30px] h-[30px] rounded-lg bg-[#F6F5F3] flex items-center justify-center"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5 text-[#4B4B52]" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteRuleConfirmId(rule.id)}
                    className="w-[30px] h-[30px] rounded-lg bg-[#FDECEC] flex items-center justify-center"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-[#E5484D]" strokeWidth={2} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
