import React, { useState } from "react";
import { AnalyticsBreadcrumbs, BreadcrumbSegment } from "@/components/analytics/AnalyticsBreadcrumbs";
import { YesterdayLoggingStrip } from "@/components/team-lead/YesterdayLoggingStrip";
import { TodayTeamBoard } from "@/components/team-lead/TodayTeamBoard";
import { BlockedAndReviewQueue } from "@/components/team-lead/BlockedAndReviewQueue";
import { OneOnOnePrepModal } from "@/components/team-lead/OneOnOnePrepModal";
import { useTeamLeadData, MemberPerformancePack } from "@/hooks/useTeamLeadData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Users2, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function TeamLeadDashboardPage() {
  const {
    todayStr,
    yesterdayStr,
    selectedDepartment,
    setSelectedDepartment,
    availableDepartments,
    liveTeamStatuses,
    yesterdayTotalCount,
    yesterdaySubmittedCount,
    yesterdayMissingCount,
    blockedAndReviewQueue,
    getMemberPerformancePack,
    nudgeMember,
    nudgeAllMissing,
  } = useTeamLeadData();

  // 1:1 Prep Modal State
  const [selectedMemberPack, setSelectedMemberPack] = useState<MemberPerformancePack | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const handleOpenOneOnOne = (memberId: string) => {
    const pack = getMemberPerformancePack(memberId);
    if (pack) {
      setSelectedMemberPack(pack);
      setIsModalOpen(true);
    }
  };

  const copyShareableUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Team view URL copied to clipboard!");
  };

  const breadcrumbs: BreadcrumbSegment[] = [
    { label: "Executive Control Room", href: "/analytics" },
    { label: "Department", href: "/analytics/department" },
    { label: `Team Lead Deck (${selectedDepartment})`, level: "team" },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto w-full pb-16">
      {/* 1. Header Toolbar & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="space-y-1">
          <AnalyticsBreadcrumbs segments={breadcrumbs} />
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Team Lead Operations Deck
            </h1>
            {/* Squad / Department Selector */}
            <div className="w-[180px]">
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="h-8 text-xs font-semibold bg-background">
                  <div className="flex items-center gap-1.5 truncate">
                    <Users2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <SelectValue placeholder="Select Squad" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {availableDepartments.map((dept) => (
                    <SelectItem key={dept} value={dept} className="text-xs">
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Daily team presence, standup completion, code reviews, blockers, and 1:1 coaching dossiers
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={copyShareableUrl}
            className="text-xs h-8 gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share View
          </Button>
        </div>
      </div>

      {/* 2. Yesterday's Logging Compliance Strip */}
      <YesterdayLoggingStrip
        yesterdayStr={yesterdayStr}
        totalCount={yesterdayTotalCount}
        submittedCount={yesterdaySubmittedCount}
        missingCount={yesterdayMissingCount}
        members={liveTeamStatuses}
        onNudgeAll={nudgeAllMissing}
        onNudgeOne={nudgeMember}
      />

      {/* 3. Today's Live Team Board */}
      <TodayTeamBoard
        members={liveTeamStatuses}
        onOpenOneOnOne={handleOpenOneOnOne}
        onNudge={nudgeMember}
      />

      {/* 4. Action Queue: Blockers & Code Reviews */}
      <BlockedAndReviewQueue tasks={blockedAndReviewQueue} />

      {/* 5. 1:1 Performance Dossier Modal */}
      <OneOnOnePrepModal
        pack={selectedMemberPack}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

