import * as React from "react";
import { cn } from "@/lib/utils";

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  valueClassName?: string;
  sub?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  iconClassName?: string;
  trailing?: React.ReactNode;
  variant?: "card" | "row";
  active?: boolean;
}

export function MetricCard({
  label,
  value,
  valueClassName,
  sub,
  description,
  icon,
  iconClassName,
  trailing,
  variant = "card",
  active,
  onClick,
  className,
  ...props
}: MetricCardProps) {
  const isClickable = !!onClick;
  const subtitle = sub ?? description;

  if (variant === "row") {
    return (
      <div
        onClick={onClick}
        className={cn(
          "p-5 flex items-center gap-3.5 min-w-0 transition-colors",
          isClickable && "cursor-pointer hover:bg-[#F6F5F3]/50",
          active && "bg-[#F6F5F3]",
          className
        )}
        {...props}
      >
        {icon && (
          <div
            className={cn(
              "w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0",
              iconClassName || "bg-[#F6F5F3] text-[#8B8B92]"
            )}
          >
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-[#8B8B92] font-medium truncate">{label}</p>
          <p className={cn("text-[24px] font-bold text-[#17171A] tracking-[-0.5px] leading-tight", valueClassName)}>
            {value}
          </p>
          {subtitle && (
            <p className="text-[11px] text-[#8B8B92] mt-0.5">{subtitle}</p>
          )}
        </div>
        {trailing}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white border border-black/[0.075] rounded-xl p-3.5 min-w-0 transition-all",
        isClickable && "cursor-pointer hover:border-black/20 hover:shadow-sm",
        className
      )}
      {...props}
    >
      {icon ? (
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="text-[10px] font-semibold text-[#8B8B92] tracking-wide uppercase truncate">
            {label}
          </div>
          <div
            className={cn(
              "w-7 h-7 rounded-lg bg-[#F6F5F3] text-[#8B8B92] flex items-center justify-center shrink-0",
              iconClassName
            )}
          >
            {icon}
          </div>
        </div>
      ) : (
        <div className="text-[10px] font-semibold text-[#8B8B92] tracking-wide uppercase truncate">
          {label}
        </div>
      )}
      <div className={cn("text-[22px] font-bold tracking-[-0.4px] text-[#17171A] leading-none", !icon && "mt-2", valueClassName)}>
        {value}
      </div>
      {subtitle && (
        <div className="text-[10px] text-[#96969D] mt-1.5 leading-snug">
          {subtitle}
        </div>
      )}
    </div>
  );
}

export interface MetricGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 2 | 3 | 4;
}

export function MetricGroup({
  columns = 3,
  className,
  children,
  ...props
}: MetricGroupProps) {
  const colClass =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : "sm:grid-cols-3";

  return (
    <div
      className={cn(
        "bg-white border border-black/[0.08] rounded-[14px] grid grid-cols-1 divide-y sm:divide-y-0 sm:divide-x divide-black/[0.07] overflow-hidden shadow-sm shrink-0",
        colClass,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
