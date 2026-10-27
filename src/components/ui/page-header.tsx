import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  children,
  className,
  ...props
}: PageHeaderProps) {
  const rightContent = actions ?? children;

  return (
    <div
      className={cn(
        "flex items-center justify-between pb-1 flex-wrap gap-3 shrink-0",
        className
      )}
      {...props}
    >
      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.5px] text-[#17171A]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13.5px] text-[#8B8B92] mt-0.5 font-normal">
            {subtitle}
          </p>
        )}
      </div>
      {rightContent && (
        <div className="flex items-center gap-2.5 flex-wrap">
          {rightContent}
        </div>
      )}
    </div>
  );
}
