import React, { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Bookmark, Plus, Trash2, Check, Sparkles } from "lucide-react";
import { TruncatedTitle } from "@/components/ui/truncated-title";
import { toast } from "sonner";
import { AnalyticsFilterState, DEFAULT_ANALYTICS_FILTERS } from "@/lib/analytics-filter-utils";

export interface SavedView {
  id: string;
  name: string;
  isSystem?: boolean;
  filters: Partial<AnalyticsFilterState>;
}

const STORAGE_KEY = "ziel_analytics_saved_views";

const SYSTEM_VIEWS: SavedView[] = [
  {
    id: "system-mtd",
    name: "Company MTD Overview",
    isSystem: true,
    filters: {
      preset: "mtd",
      comparison: "previous_period",
      granularity: "month",
      workMode: "all",
      billableOnly: false,
    },
  },
  {
    id: "system-30d",
    name: "Last 30 Days (Rolling)",
    isSystem: true,
    filters: {
      preset: "last_30_days",
      comparison: "previous_period",
      granularity: "week",
      workMode: "all",
    },
  },
  {
    id: "system-billable",
    name: "Billable Utilization Focus",
    isSystem: true,
    filters: {
      preset: "mtd",
      comparison: "previous_period",
      granularity: "month",
      billableOnly: true,
    },
  },
];

export interface SavedViewsDropdownProps {
  currentFilters: AnalyticsFilterState;
  onApplyView: (filters: Partial<AnalyticsFilterState>) => void;
}

export function SavedViewsDropdown({ currentFilters, onApplyView }: SavedViewsDropdownProps) {
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>("system-mtd");
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [viewName, setViewName] = useState("");

  // Load custom views from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSavedViews(parsed);
      }
    } catch (e) {
      console.error("Failed to load saved views", e);
    }
  }, []);

  const allViews = [...SYSTEM_VIEWS, ...savedViews];

  const handleSaveCurrent = () => {
    if (!viewName.trim()) {
      toast.error("Please enter a name for the view");
      return;
    }

    const newView: SavedView = {
      id: `custom-${Date.now()}`,
      name: viewName.trim(),
      filters: { ...currentFilters },
    };

    const updated = [...savedViews, newView];
    setSavedViews(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      toast.success(`View "${viewName}" saved!`);
    } catch (e) {
      toast.error("Failed to save view to local storage");
    }

    setActiveViewId(newView.id);
    setViewName("");
    setSaveModalOpen(false);
  };

  const handleDeleteView = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedViews.filter((v) => v.id !== id);
    setSavedViews(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      toast.success("Saved view deleted");
    } catch (e) {
      // ignore
    }
    if (activeViewId === id) setActiveViewId(null);
  };

  const handleSelectView = (view: SavedView) => {
    setActiveViewId(view.id);
    onApplyView(view.filters);
    toast.info(`Switched to "${view.name}"`);
  };

  const activeView = allViews.find((v) => v.id === activeViewId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold px-2.5 border-black/[0.1] dark:border-white/[0.1] flex items-center gap-1.5"
          >
            <Bookmark className="h-3.5 w-3.5 text-primary" />
            <TruncatedTitle
              text={activeView ? activeView.name : "Saved Views"}
              className="max-w-[130px] truncate"
            />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56 p-1 text-xs">
          <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
            Standard Views
          </DropdownMenuLabel>
          {SYSTEM_VIEWS.map((view) => (
            <DropdownMenuItem
              key={view.id}
              onClick={() => handleSelectView(view)}
              className="flex items-center justify-between cursor-pointer px-2 py-1.5"
            >
              <span className="flex items-center gap-2 truncate">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">{view.name}</span>
              </span>
              {activeViewId === view.id && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1 flex items-center justify-between">
            <span>Custom Views</span>
            <span className="text-[10px] lowercase font-normal">{savedViews.length} saved</span>
          </DropdownMenuLabel>

          {savedViews.length === 0 ? (
            <div className="px-2 py-2 text-[11px] text-muted-foreground italic text-center">
              No custom views yet
            </div>
          ) : (
            savedViews.map((view) => (
              <DropdownMenuItem
                key={view.id}
                onClick={() => handleSelectView(view)}
                className="flex items-center justify-between group cursor-pointer px-2 py-1.5"
              >
                <span className="truncate mr-2">{view.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {activeViewId === view.id && <Check className="h-3.5 w-3.5 text-primary" />}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteView(view.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </DropdownMenuItem>
            ))
          )}

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuItem
            onClick={() => setSaveModalOpen(true)}
            className="flex items-center gap-2 text-primary font-semibold cursor-pointer px-2 py-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Save Current View</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Current Filter Preset</DialogTitle>
            <DialogDescription>
              Give this view a memorable name to quickly restore your date range, cascading filters,
              and comparisons.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3">
            <Input
              placeholder="e.g., Engineering Team Q3 Review"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveCurrent();
              }}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSaveModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveCurrent}>
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
