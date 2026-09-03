import React from "react";
import { Info } from "lucide-react";

export interface AttendanceScoreGaugeProps {
  score?: number;
  scoreChange?: string;
  recommendationTitle?: string;
  recommendationDesc?: string;
}

export function getAttendanceScoreDetails(score: number) {
  if (score >= 90) {
    return {
      title: "Great attendance this week ✓",
      description: "Team attendance is trending above target with minimal lateness across the whole team this week.",
    };
  }
  if (score >= 75) {
    return {
      title: "Good attendance performance",
      description: "Most employees are present, but a few late clock-ins were recorded this week.",
    };
  }
  if (score >= 60) {
    return {
      title: "Fair attendance – Lateness alert",
      description: "Noticeable increase in late clock-ins or absences this week. Manager review recommended.",
    };
  }
  return {
    title: "Critical attendance alert",
    description: "Team attendance is significantly below target due to frequent lateness or unexcused absences.",
  };
}

export function AttendanceScoreGauge({
  score = 94,
  scoreChange = "+1",
  recommendationTitle,
  recommendationDesc,
}: AttendanceScoreGaugeProps) {
  // Arc length calculations for 180-degree gauge (R=90, Arc length ~ 282.7)
  const arcLength = 282.7;
  const clampedScore = Math.min(100, Math.max(0, score));
  const strokeDashoffset = arcLength - (arcLength * clampedScore) / 100;

  // Get dynamic title & description based on the score threshold
  const dynamicDetails = getAttendanceScoreDetails(clampedScore);
  const displayTitle = recommendationTitle || dynamicDetails.title;
  const displayDesc = recommendationDesc || dynamicDetails.description;

  return (
    <div className="bg-white border border-black/[0.08] rounded-[14px] p-[22px] flex flex-col justify-between shadow-sm font-sans h-full">
      {/* Title */}
      <div className="flex items-center gap-1.5 text-[14.5px] font-bold text-[#17171A] mb-[20px]">
        Attendance Score
        <Info className="h-3.5 w-3.5 text-[#C6C6CC]" />
      </div>

      {/* Semi-circle Arc Gauge */}
      <div className="flex justify-center py-[6px] pb-[8px]">
        <div className="relative w-[220px] h-[152px]">
          <svg width="220" height="140" viewBox="0 0 220 140" className="absolute top-0 left-0">
            <path
              d="M 20 120 A 90 90 0 0 1 200 120"
              fill="none"
              stroke="#F3E9E3"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <path
              d="M 20 120 A 90 90 0 0 1 200 120"
              fill="none"
              stroke="#EB5A1E"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={arcLength}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          {/* Centered Score Display */}
          <div className="absolute top-[56px] left-0 right-0 h-[40px] leading-[40px] flex items-center justify-center">
            <span className="text-[40px] font-bold text-[#17171A] leading-none">{clampedScore}</span>
          </div>
          <div className="absolute top-[128px] left-0 right-0 text-center text-[12.5px] text-[#8B8B92]">
            of 100 points
          </div>
        </div>
      </div>

      {/* Recommendation Sub-Card with Dynamic Text */}
      <div className="bg-[#F6F5F3] rounded-[12px] p-[16px] flex-1 flex flex-col gap-2">
        <div className="font-bold text-[13.5px] text-[#17171A]">{displayTitle}</div>
        <div className="text-[12.5px] text-[#8B8B92] leading-[1.5]">{displayDesc}</div>
      </div>
    </div>
  );
}
