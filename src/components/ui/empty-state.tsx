import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  message?: React.ReactNode;
  variant?: "card" | "inline";
  isLoading?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  message,
  variant = "card",
  isLoading = false,
  className,
  children,
  ...props
}: EmptyStateProps) {
  const content = children ?? message;

  return (
    <div
      className={cn(
        "text-center text-[#8B8B92] font-sans flex flex-col items-center justify-center",
        variant === "card" &&
          "flex-1 min-h-0 bg-white border border-black/[0.08] rounded-[14px] p-8 sm:p-12 text-sm shadow-sm",
        variant === "inline" && "px-4 py-8 text-sm",
        className
      )}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-[#8B8B92]">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em]" />
          <span>{content || "Loading…"}</span>
        </div>
      ) : (
        <>
          {icon && (
            <div className="w-12 h-12 rounded-[12px] bg-[#F6F5F3] text-[#8B8B92] flex items-center justify-center mb-3">
              {icon}
            </div>
          )}
          {title && (
            <p className="text-[14px] font-semibold text-[#17171A]">
              {title}
            </p>
          )}
          {description && (
            <p className="text-[12.5px] text-[#8B8B92] mt-1">
              {description}
            </p>
          )}
          {content && !title && !description && (
            <p className="text-[13px] text-[#8B8B92]">{content}</p>
          )}
          {action && <div className="mt-4">{action}</div>}
        </>
      )}
    </div>
  );
}
