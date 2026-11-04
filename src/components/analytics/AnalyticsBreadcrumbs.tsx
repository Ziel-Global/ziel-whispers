import React from "react";
import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router-dom";

export interface BreadcrumbSegment {
  label: string;
  level?: "company" | "department" | "team" | "person" | "project" | "task" | "log";
  value?: string;
  href?: string;
}

interface AnalyticsBreadcrumbsProps {
  segments: BreadcrumbSegment[];
  onSegmentClick?: (segment: BreadcrumbSegment, index: number) => void;
  className?: string;
}

export function AnalyticsBreadcrumbs({
  segments,
  onSegmentClick,
  className = "",
}: AnalyticsBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center space-x-1 text-xs ${className}`}>
      <Link
        to="/analytics"
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Home className="h-3.5 w-3.5 text-primary" />
        <span className="font-semibold">Analytics Hub</span>
      </Link>

      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;

        return (
          <React.Fragment key={`${seg.level || "seg"}-${idx}`}>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
            {isLast ? (
              <span className="font-semibold text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                {seg.label}
              </span>
            ) : seg.href ? (
              <Link
                to={seg.href}
                className="text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5 rounded"
              >
                {seg.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onSegmentClick?.(seg, idx)}
                className="text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5 rounded"
              >
                {seg.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
