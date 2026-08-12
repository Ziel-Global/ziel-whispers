import { cn } from "@/lib/utils";

export const editButtonClass =
  "shrink-0 p-1.5 rounded bg-primary text-white hover:bg-black transition-colors";

interface DataRowProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  gridCols?: string;
}

export function DataRow({
  children,
  onClick,
  className,
  gridCols,
}: DataRowProps) {
  return (
    <div
      className={cn(
        "bg-white hover:bg-[#f1f5f9] border-b border-[#f3f4f6] px-4 py-3 transition-colors",
        onClick && "cursor-pointer",
        gridCols && "md:grid md:gap-4 md:items-center",
        className,
      )}
      onClick={onClick}
      style={
        gridCols
          ? ({ gridTemplateColumns: gridCols } as React.CSSProperties)
          : undefined
      }
    >
      {gridCols ? (
        <>{children}</>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      )}
    </div>
  );
}

export function RowPrimary({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "font-semibold text-[15px] text-[#111827] truncate",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function RowSecondary({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("text-[12px] text-[#6b7280] mt-0.5 truncate", className)}
    >
      {children}
    </div>
  );
}

export function RowDataGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-x-6 gap-y-2 mt-3", className)}>
      {children}
    </div>
  );
}

export function RowDataItem({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">
        {label}
      </div>
      <div className="text-[13px] text-[#374151] mt-0.5 md:mt-0 truncate">
        {children}
      </div>
    </div>
  );
}

export function RowBadgeItem({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">
        {label}
      </div>
      <div className="mt-0.5 md:mt-0">{children}</div>
    </div>
  );
}

export function RowActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 shrink-0", className)}>
      {children}
    </div>
  );
}

export function TableHeader({
  children,
  className,
  gridCols,
}: {
  children: React.ReactNode;
  className?: string;
  gridCols?: string;
}) {
  return (
    <div
      className={cn(
        "hidden md:flex md:items-center px-4 py-2 border-b border-[#e5e7eb] text-[11px] uppercase tracking-[0.05em] text-[#9ca3af] font-medium",
        gridCols && "md:grid md:gap-4",
        className,
      )}
      style={
        gridCols
          ? ({ gridTemplateColumns: gridCols } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </div>
  );
}
