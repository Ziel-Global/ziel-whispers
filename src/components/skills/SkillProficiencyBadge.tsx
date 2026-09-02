import React from "react";
import { Badge } from "@/components/ui/badge";
import { ProficiencyLevel, PROFICIENCY_MAP } from "@/types/skills";
import { Star } from "lucide-react";

export interface SkillProficiencyBadgeProps {
  level: ProficiencyLevel;
  showStars?: boolean;
  showDescription?: boolean;
  size?: "sm" | "md" | "lg";
}

export function SkillProficiencyBadge({
  level,
  showStars = true,
  showDescription = false,
  _size = "md",
}: SkillProficiencyBadgeProps & { _size?: "sm" | "md" | "lg" }) {
  const info = PROFICIENCY_MAP[level] || PROFICIENCY_MAP[1];

  const starCount = level;

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Badge className={`${info.bgLight} border border-current font-medium text-xs rounded-full px-2.5 py-0.5`}>
          Level {level}: {info.label}
        </Badge>
        {showStars && (
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-3 w-3 ${
                  star <= starCount
                    ? "text-amber-500 fill-amber-500"
                    : "text-gray-300"
                }`}
              />
            ))}
          </div>
        )}
      </div>
      {showDescription && (
        <p className="text-[11px] text-muted-foreground leading-tight">
          {info.description}
        </p>
      )}
    </div>
  );
}

export function SkillProgressBar({ level }: { level: ProficiencyLevel }) {
  const percentage = (level / 5) * 100;
  const info = PROFICIENCY_MAP[level] || PROFICIENCY_MAP[1];

  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{info.label}</span>
        <span className="text-muted-foreground">{level} / 5</span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
