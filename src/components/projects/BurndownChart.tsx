import { useEffect, useId, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Customized,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface BurndownDataPoint {
  name: string;
  actual: number | null;
  isNow?: boolean;
  dayIndex?: number;
}

interface BurndownChartProps {
  totalEst: number;
  loggedHrs: number;
  remaining: number;
  unestimatedCount: number;
  burndownData: BurndownDataPoint[];
  totalEstimatedHours: number;
  burndownScope: string;
  onScopeChange: (scope: string) => void;
  phases: Array<{ id: string; title: string }>;
  emptyMessage: string;
  className?: string;
}

type ChartPoint = {
  chartIndex: number;
  displayActual: number;
  hoverRemaining: number;
  isNow?: boolean;
};

const ORANGE = "#EC6824";
const formatHours = (value: number) => `${value.toFixed(1)}h`;

/** Get real remaining at a day index (for tooltips) */
function getRealRemainingAt(
  burndownData: BurndownDataPoint[],
  dayIndex: number,
  totalEst: number,
  remaining: number,
  nowIndex: number,
): number {
  if (dayIndex <= nowIndex) {
    const point = burndownData[Math.min(Math.round(dayIndex), nowIndex)];
    if (point?.actual != null) return point.actual;
    if (dayIndex === 0) return totalEst;
    if (Math.round(dayIndex) === nowIndex) return remaining;
  }
  return remaining;
}

/**
 * Build step-based display data for staircase burndown.
 * Preserves flat segments and vertical drops from daily data.
 */
function buildStepDisplayData(
  burndownData: BurndownDataPoint[],
  totalEst: number,
  remaining: number,
): { chartData: ChartPoint[]; nowIndex: number; timelineEnd: number } {
  const timelineEnd = Math.max(1, burndownData.length - 1);
  const nowIndex = burndownData.findIndex((d) => d.isNow);
  const effectiveNow =
    nowIndex >= 0 ? nowIndex : Math.round(timelineEnd * 0.55);

  const chartData: ChartPoint[] = [];

  for (let i = 0; i < burndownData.length; i++) {
    const point = burndownData[i];
    const val =
      point.actual != null
        ? point.actual
        : i <= effectiveNow
          ? totalEst
          : remaining;
    chartData.push({
      chartIndex: i,
      displayActual: Math.max(0, val),
      hoverRemaining: getRealRemainingAt(
        burndownData,
        i,
        totalEst,
        remaining,
        effectiveNow,
      ),
      isNow: point.isNow,
    });
  }

  return { chartData, nowIndex: effectiveNow, timelineEnd };
}

function NowOverlay({
  nowIndex,
  remaining,
  showTooltip,
  xAxisMap,
  yAxisMap,
  offset,
  displayY,
}: {
  nowIndex: number;
  remaining: number;
  showTooltip: boolean;
  displayY: number;
  xAxisMap?: Record<
    string,
    { scale: (v: number) => number; bandwidth?: () => number }
  >;
  yAxisMap?: Record<string, { scale: (v: number) => number }>;
  offset?: { top: number; left: number; width: number; height: number };
}) {
  if (nowIndex < 0 || !xAxisMap || !yAxisMap || !offset) return null;

  const xAxis = Object.values(xAxisMap)[0];
  const yAxis = Object.values(yAxisMap)[0];
  if (!xAxis?.scale || !yAxis?.scale) return null;

  const x =
    xAxis.scale(nowIndex) + (xAxis.bandwidth?.() ?? 0) / 2 + offset.left;
  const y = yAxis.scale(displayY) + offset.top;
  const bottom = offset.top + offset.height;

  return (
    <g>
      <line
        x1={x}
        y1={bottom}
        x2={x}
        y2={y - 6}
        stroke="#D1D5DB"
        strokeWidth={1}
        strokeDasharray="2 3"
      />
      <circle cx={x} cy={y} r={5} fill={ORANGE} stroke="#fff" strokeWidth={2} />
      {showTooltip && (
        <foreignObject
          x={x - 60}
          y={y - 68}
          width={120}
          height={52}
          className="overflow-visible"
        >
          <div className="flex justify-center">
            <div className="rounded-lg bg-[#1A1A1A] px-3.5 py-2 text-center shadow-[0_4px_16px_rgba(0,0,0,0.22)] animate-in fade-in-0 slide-in-from-bottom-1 duration-500">
              <p className="text-[10px] font-medium leading-tight text-[#9CA3AF]">
                Now
              </p>
              <p className="text-[11px] font-bold leading-tight text-white">
                Remaining: {formatHours(displayY)}
              </p>
            </div>
          </div>
        </foreignObject>
      )}
    </g>
  );
}

export function BurndownChart({
  totalEst,
  loggedHrs,
  remaining,
  unestimatedCount,
  burndownData,
  totalEstimatedHours,
  burndownScope,
  onScopeChange,
  phases,
  emptyMessage,
  className = "",
}: BurndownChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const [showNowTooltip, setShowNowTooltip] = useState(false);

  const hasData = burndownData.length > 0;

  const { chartData, nowIndex, timelineEnd } = useMemo(
    () => buildStepDisplayData(burndownData, totalEst, remaining),
    [burndownData, totalEst, remaining],
  );

  const nowPoint = chartData.find((d) => d.isNow);
  const nowPercent = timelineEnd > 0 ? nowIndex / timelineEnd : 0.5;

  const chartKey = useMemo(
    () =>
      chartData
        .map((d) => `${d.chartIndex.toFixed(2)}-${d.displayActual.toFixed(1)}`)
        .join("|"),
    [chartData],
  );

  useEffect(() => {
    setShowNowTooltip(false);
    const timer = window.setTimeout(() => setShowNowTooltip(true), 1100);
    return () => window.clearTimeout(timer);
  }, [chartKey, remaining]);

  return (
    <div
      className={`overflow-visible rounded-[16px] border border-[#E5E7EB] bg-white p-7 shadow-sm ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold tracking-tight text-[#111827]">
          Burndown
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-medium text-[#6B7280]">Scope:</span>
          <Select value={burndownScope} onValueChange={onScopeChange}>
            <SelectTrigger className="h-8 min-w-[120px] rounded-lg border-[#E5E7EB] bg-white text-xs font-medium text-[#374151] shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="project">Project</SelectItem>
              {phases.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasData && (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span className="text-[#6B7280]">
            Total estimated:{" "}
            <strong className="font-semibold tabular-nums text-[#111827]">
              {formatHours(totalEst)}
            </strong>
          </span>
          <span className="text-[#6B7280]">
            Logged:{" "}
            <strong className="font-semibold tabular-nums text-[#111827]">
              {formatHours(loggedHrs)}
            </strong>
          </span>
          <span className="text-[#6B7280]">
            Remaining:{" "}
            <strong className="font-semibold tabular-nums text-[#111827]">
              {formatHours(remaining)}
            </strong>
          </span>
          <span className="font-medium text-[#EC6824]">
            Unestimated:{" "}
            <strong className="font-semibold tabular-nums">
              {unestimatedCount} task{unestimatedCount === 1 ? "" : "s"}
            </strong>
          </span>
        </div>
      )}

      {!hasData ? (
        <p className="py-4 text-xs text-[#9CA3AF]">{emptyMessage}</p>
      ) : (
        <div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              key={chartKey}
              data={chartData}
              margin={{ top: 58, right: 8, left: 8, bottom: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ORANGE} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={ORANGE} stopOpacity={0} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="chartIndex"
                type="number"
                domain={[0, timelineEnd]}
                hide
                padding={{ left: 0, right: 0 }}
              />

              <CartesianGrid
                horizontal={true}
                vertical={false}
                stroke="#F3F4F6"
                strokeDasharray="3 3"
              />

              <YAxis
                hide
                domain={[
                  (dataMin: number) => Math.floor(dataMin * 0.9),
                  (dataMax: number) =>
                    Math.ceil(Math.max(dataMax, totalEstimatedHours) * 1.05),
                ]}
              />

              <ReferenceLine
                y={totalEstimatedHours}
                stroke="#D1D5DB"
                strokeDasharray="6 5"
                strokeWidth={1.5}
                ifOverflow="extendDomain"
              />

              <Area
                type="linear"
                dataKey="displayActual"
                stroke={ORANGE}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={`url(#${gradientId})`}
                connectNulls
                name="Remaining"
                isAnimationActive
                animationDuration={1600}
                animationEasing="ease-out"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: ORANGE,
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
              />

              <Customized
                component={(props: {
                  xAxisMap?: Record<
                    string,
                    { scale: (v: number) => number; bandwidth?: () => number }
                  >;
                  yAxisMap?: Record<string, { scale: (v: number) => number }>;
                  offset?: {
                    top: number;
                    left: number;
                    width: number;
                    height: number;
                  };
                }) => (
                  <NowOverlay
                    nowIndex={nowIndex}
                    remaining={remaining}
                    showTooltip={showNowTooltip}
                    displayY={nowPoint?.displayActual ?? remaining}
                    xAxisMap={props.xAxisMap}
                    yAxisMap={props.yAxisMap}
                    offset={props.offset}
                  />
                )}
              />
            </AreaChart>
          </ResponsiveContainer>

          <div className="relative mt-2 h-5 px-2">
            <span className="absolute left-0 text-[12px] font-medium text-[#9CA3AF]">
              Start
            </span>
            {nowIndex >= 0 && (
              <span
                className="absolute text-[11px] font-medium text-[#9CA3AF]"
                style={{
                  left: `${nowPercent * 100}%`,
                  transform: "translateX(-50%)",
                }}
              >
                Now
              </span>
            )}
            <span className="absolute right-0 text-[11px] font-medium text-[#9CA3AF]">
              Due
            </span>
          </div>

          <div className="mt-4 flex items-center gap-6 pl-1">
            <div className="flex items-center gap-2">
              <span className="h-[3px] w-5 rounded-full bg-[#EC6824]" />
              <span className="text-[10px] font-medium text-[#6B7280]">
                Remaining
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 border-t-[1.5px] border-dashed border-[#9CA3AF]" />
              <span className="text-[10px] font-medium text-[#6B7280]">
                Total estimated
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
