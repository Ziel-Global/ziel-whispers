import { useId, useMemo, useState, type Ref } from "react";
import type { WorkflowStatus, WorkflowTransition } from "@/lib/workflow";

type CardSide = "left" | "right" | "top" | "bottom";

type PathEdge = {
  sourceIndex: number;
  targetIndex: number;
  sourceId: string;
  targetId: string;
  direction: "forward" | "backward";
  primary: boolean;
  sourceSide: CardSide;
  targetSide: CardSide;
  lane?: number;
  sourceAlong?: number;
  targetAlong?: number;
  sourceStub?: number;
  targetStub?: number;
  midShift?: number;
};

type Layout = {
  width: number;
  height: number;
  nodeY: number;
  nodeMidY: number;
  positions: { x: number; y: number }[];
  edges: PathEdge[];
};

const NODE_W = 168;
const NODE_H = 76;
const GAP = 84;
const PAD_X = 42;
const LANE_STEP = 28;
const PORT_STEP = 22;
const ALONG_TOP_STEP = 36;
const STUB_BASE = 18;
const STUB_STEP = 8;
const MAX_STUB = 40;
const PRIMARY_MID_STEP = 10;
const MAX_PER_SIDE = 2;

const CATEGORY_LABEL: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

function categoryLabel(category: string) {
  return CATEGORY_LABEL[category] || category.replace(/_/g, " ");
}

function stubDistance(index: number) {
  return Math.min(STUB_BASE + index * STUB_STEP, MAX_STUB);
}

function centeredOffsets(total: number, step = 14) {
  if (total <= 0) return [];
  if (total === 1) return [0];
  const offsets: number[] = [];
  if (total % 2 === 1) {
    offsets.push(0);
    for (let i = 1; i <= Math.floor(total / 2); i++) {
      offsets.push(-i * step, i * step);
    }
  } else {
    for (let i = 0; i < total / 2; i++) {
      offsets.push(-(step / 2 + i * step), step / 2 + i * step);
    }
  }
  return offsets;
}

function addToGroup<K>(map: Map<K, PathEdge[]>, key: K, edge: PathEdge) {
  const list = map.get(key);
  if (list) list.push(edge);
  else map.set(key, [edge]);
}

function edgePriority(edge: PathEdge) {
  return Math.abs(edge.targetIndex - edge.sourceIndex);
}

function sideKey(index: number, side: CardSide) {
  return `${index}:${side}`;
}

function takeSide(
  index: number,
  preferred: CardSide,
  overflow: CardSide,
  counts: Map<string, number>
): CardSide {
  const preferredKey = sideKey(index, preferred);
  const used = counts.get(preferredKey) || 0;
  if (used < MAX_PER_SIDE) {
    counts.set(preferredKey, used + 1);
    return preferred;
  }
  const overflowKey = sideKey(index, overflow);
  counts.set(overflowKey, (counts.get(overflowKey) || 0) + 1);
  return overflow;
}

function isGapRoute(edge: PathEdge) {
  return edge.primary && edge.sourceSide === "right" && edge.targetSide === "left";
}

function assignAlong(edges: PathEdge[]) {
  const groups = new Map<string, { edge: PathEdge; field: "sourceAlong" | "targetAlong" }[]>();

  const addSlot = (edge: PathEdge, index: number, side: CardSide, field: "sourceAlong" | "targetAlong") => {
    const key = sideKey(index, side);
    const list = groups.get(key);
    const slot = { edge, field };
    if (list) list.push(slot);
    else groups.set(key, [slot]);
  };

  edges.forEach((edge) => {
    addSlot(edge, edge.sourceIndex, edge.sourceSide, "sourceAlong");
    addSlot(edge, edge.targetIndex, edge.targetSide, "targetAlong");
  });

  groups.forEach((list, key) => {
    const side = key.split(":")[1] as CardSide;
    const step = side === "left" || side === "right" ? PORT_STEP : ALONG_TOP_STEP;
    list.sort((a, b) => edgePriority(a.edge) - edgePriority(b.edge));
    const offsets = centeredOffsets(list.length, step);
    list.forEach((slot, i) => {
      slot.edge[slot.field] = offsets[i];
    });
  });
}

function assignStubDistances(
  edges: PathEdge[],
  groupKey: (edge: PathEdge) => string,
  field: "sourceStub" | "targetStub"
) {
  const groups = new Map<string, PathEdge[]>();
  edges.forEach((edge) => addToGroup(groups, groupKey(edge), edge));
  groups.forEach((list) => {
    list.sort((a, b) => edgePriority(a) - edgePriority(b));
    list.forEach((edge, i) => {
      edge[field] = stubDistance(i);
    });
  });
}

function buildLayout(statuses: WorkflowStatus[], transitions: WorkflowTransition[]): Layout {
  const idToIndex = new Map(statuses.map((s, i) => [s.id, i]));
  const edges: PathEdge[] = [];

  transitions.forEach((t) => {
    if (!t.from_status_id) return;
    const sourceIndex = idToIndex.get(t.from_status_id);
    const targetIndex = idToIndex.get(t.to_status_id);
    if (sourceIndex === undefined || targetIndex === undefined) return;
    if (sourceIndex === targetIndex) return;
    edges.push({
      sourceIndex,
      targetIndex,
      sourceId: t.from_status_id,
      targetId: t.to_status_id,
      direction: targetIndex > sourceIndex ? "forward" : "backward",
      primary: targetIndex === sourceIndex + 1,
      sourceSide: "right",
      targetSide: "left",
    });
  });

  const counts = new Map<string, number>();
  const forwards = edges
    .filter((e) => e.direction === "forward")
    .sort((a, b) => {
      const span = edgePriority(a) - edgePriority(b);
      if (span !== 0) return span;
      return a.sourceIndex - b.sourceIndex;
    });

  forwards.forEach((edge) => {
    edge.sourceSide = takeSide(edge.sourceIndex, "right", "top", counts);
    edge.targetSide = takeSide(edge.targetIndex, "left", "top", counts);
  });

  const backwardEdges = edges
    .filter((e) => e.direction === "backward")
    .sort((a, b) => {
      const spanA = a.sourceIndex - a.targetIndex;
      const spanB = b.sourceIndex - b.targetIndex;
      if (spanA !== spanB) return spanA - spanB;
      return a.targetIndex - b.targetIndex;
    });

  backwardEdges.forEach((edge) => {
    edge.sourceSide = "bottom";
    edge.targetSide = "bottom";
    const srcKey = sideKey(edge.sourceIndex, "bottom");
    const tgtKey = sideKey(edge.targetIndex, "bottom");
    counts.set(srcKey, (counts.get(srcKey) || 0) + 1);
    counts.set(tgtKey, (counts.get(tgtKey) || 0) + 1);
  });

  const topRouted = edges.filter((e) => e.direction === "forward" && !isGapRoute(e));
  topRouted.sort((a, b) => {
    const span = edgePriority(a) - edgePriority(b);
    if (span !== 0) return span;
    return a.sourceIndex - b.sourceIndex;
  });
  topRouted.forEach((edge, i) => {
    edge.lane = i;
  });
  backwardEdges.forEach((edge, i) => {
    edge.lane = i;
  });

  const maxForwardLane = topRouted.length ? topRouted.length - 1 : -1;
  const maxBackwardLane = backwardEdges.length ? backwardEdges.length - 1 : -1;
  const topLaneRoom = 54 + Math.max(0, maxForwardLane) * LANE_STEP;
  const bottomLaneRoom = 58 + Math.max(0, maxBackwardLane) * LANE_STEP;
  const nodeY = 42 + topLaneRoom;
  const nodeMidY = nodeY + NODE_H / 2;
  const count = statuses.length;
  const width = Math.max(1140, PAD_X * 2 + count * NODE_W + (count - 1) * GAP);
  const height = nodeY + NODE_H + bottomLaneRoom + 30;
  const positions = statuses.map((_, index) => ({
    x: PAD_X + index * (NODE_W + GAP),
    y: nodeY,
  }));

  assignAlong(edges);

  const leftRightSource = edges.filter((e) => e.sourceSide === "left" || e.sourceSide === "right");
  const leftRightTarget = edges.filter((e) => e.targetSide === "left" || e.targetSide === "right");
  assignStubDistances(leftRightSource, (e) => sideKey(e.sourceIndex, e.sourceSide), "sourceStub");
  assignStubDistances(leftRightTarget, (e) => sideKey(e.targetIndex, e.targetSide), "targetStub");

  const primaryByGap = new Map<number, PathEdge[]>();
  edges.filter(isGapRoute).forEach((edge) => addToGroup(primaryByGap, edge.sourceIndex, edge));
  primaryByGap.forEach((list) => {
    list.sort((a, b) => edgePriority(a) - edgePriority(b));
    const offsets = centeredOffsets(list.length, PRIMARY_MID_STEP);
    list.forEach((edge, i) => {
      edge.midShift = offsets[i];
    });
  });

  return { width, height, nodeY, nodeMidY, positions, edges };
}

function sidePoint(
  pos: { x: number; y: number },
  side: CardSide,
  along: number,
  nodeMidY: number
) {
  if (side === "right") return { x: pos.x + NODE_W, y: nodeMidY + along };
  if (side === "left") return { x: pos.x, y: nodeMidY + along };
  if (side === "top") return { x: pos.x + NODE_W / 2 + along, y: pos.y };
  return { x: pos.x + NODE_W / 2 + along, y: pos.y + NODE_H };
}

function stubFrom(point: { x: number; y: number }, side: CardSide, stub: number) {
  if (side === "right") return { x: point.x + stub, y: point.y };
  if (side === "left") return { x: point.x - stub, y: point.y };
  if (side === "top") return { x: point.x, y: point.y - stub };
  return { x: point.x, y: point.y + stub };
}

function buildPath(edge: PathEdge, layout: Layout) {
  const source = layout.positions[edge.sourceIndex];
  const target = layout.positions[edge.targetIndex];
  const start = sidePoint(source, edge.sourceSide, edge.sourceAlong || 0, layout.nodeMidY);
  const end = sidePoint(target, edge.targetSide, edge.targetAlong || 0, layout.nodeMidY);
  const sourceStub = edge.sourceStub || STUB_BASE;
  const targetStub = edge.targetStub || STUB_BASE;
  const out = stubFrom(start, edge.sourceSide, sourceStub);
  const inn = stubFrom(end, edge.targetSide, targetStub);

  if (isGapRoute(edge)) {
    const midX = start.x + (end.x - start.x) / 2 + (edge.midShift || 0);
    return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
  }

  const laneY =
    edge.direction === "backward"
      ? layout.nodeY + NODE_H + 34 + (edge.lane || 0) * LANE_STEP
      : layout.nodeY - 34 - (edge.lane || 0) * LANE_STEP;

  return `M ${start.x} ${start.y} L ${out.x} ${out.y} L ${out.x} ${laneY} L ${inn.x} ${laneY} L ${inn.x} ${inn.y} L ${end.x} ${end.y}`;
}

export function WorkflowPathPreview({
  statuses,
  transitions,
  svgRef,
}: {
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
  svgRef?: Ref<SVGSVGElement>;
}) {
  const reactId = useId().replace(/:/g, "");
  const markerId = `workflow-arrow-${reactId}`;
  const shadowId = `flow-node-shadow-${reactId}`;
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const layout = useMemo(
    () => buildLayout(statuses, transitions),
    [statuses, transitions]
  );

  const linkedIds = useMemo(() => {
    if (!focusedId) return new Set<string>();
    const linked = new Set<string>([focusedId]);
    layout.edges.forEach((edge) => {
      if (edge.sourceId === focusedId || edge.targetId === focusedId) {
        linked.add(edge.sourceId);
        linked.add(edge.targetId);
      }
    });
    return linked;
  }, [focusedId, layout.edges]);

  if (!statuses.length) {
    return (
      <div className="workflow-path-preview min-w-0 overflow-auto rounded-xl border border-[#e7e9ee] bg-[#fcfcfd] px-3.5 pb-2 pt-3">
        <div className="grid min-h-[180px] place-items-center text-xs text-[#6f7785]">
          Add a status to start building the workflow.
        </div>
      </div>
    );
  }

  return (
    <div className="workflow-path-preview grid min-w-0 gap-2.5 overflow-auto rounded-xl border border-[#e7e9ee] bg-[#fcfcfd] px-3.5 pb-2 pt-3">
      <div className="flex min-h-7 flex-wrap items-center gap-3.5 text-[11px] text-[#6f7785]">
        <span className="text-[#9098a5]">
          Hover a stage to focus only its incoming and outgoing transitions
        </span>
      </div>

      <div className="relative" style={{ minWidth: layout.width, minHeight: Math.max(390, layout.height) }}>
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          className={`workflow-flowchart block h-auto overflow-visible ${focusedId ? "has-focus" : ""}`}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
          height={layout.height}
          role="img"
          aria-label="Workflow transition flowchart"
        >
          <style>{`
            .workflow-edge { fill: none; stroke: #a8b0bd; stroke-width: 2; stroke-dasharray: 1 7; stroke-linecap: round; stroke-linejoin: round; opacity: .58; }
            .workflow-node-card { fill: #fff; stroke: #dde2e9; stroke-width: 1.3; }
            .workflow-node-card.initial { fill: #fff9f4; stroke: #f7caa9; }
            .workflow-index-circle { fill: #f1f3f6; }
            .workflow-index-text { font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 10px; font-weight: 800; fill: #5d6674; }
            .workflow-state-pill { fill: #f4f6f8; }
            .workflow-state-text { font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 9.5px; font-weight: 700; fill: #687282; }
            .workflow-node-name { font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 12.5px; font-weight: 700; fill: #181b22; }
            .workflow-node-meta { font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 10px; fill: #7a8390; }
            .flow-arrow-head { fill: #a8b0bd; }
          `}</style>
          <defs>
            <marker
              id={markerId}
              markerWidth="12"
              markerHeight="12"
              refX="11"
              refY="6"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path
                d="M 0 0 L 12 6 L 0 12 z"
                className="flow-arrow-head"
                fill={focusedId ? "#f47a2a" : "#a8b0bd"}
              />
            </marker>
            <filter id={shadowId} x="-20%" y="-30%" width="140%" height="160%">
              <feDropShadow dx="0" dy="5" stdDeviation="5" floodOpacity=".13" />
            </filter>
          </defs>

          <g className="flow-edge-layer">
            {layout.edges.map((edge, i) => {
              const connected =
                focusedId !== null &&
                (edge.sourceId === focusedId || edge.targetId === focusedId);
              return (
                <path
                  key={`${edge.sourceId}-${edge.targetId}-${i}`}
                  d={buildPath(edge, layout)}
                  className={`workflow-edge ${connected ? "is-connected" : ""}`}
                  markerEnd={`url(#${markerId})`}
                />
              );
            })}
          </g>

          <g className="flow-node-layer">
            {statuses.map((status, index) => {
              const pos = layout.positions[index];
              const isFocused = focusedId === status.id;
              const isLinked = linkedIds.has(status.id) && !isFocused;
              const displayName =
                status.name.length > 21 ? `${status.name.slice(0, 21)}…` : status.name;
              const state = categoryLabel(status.category);

              return (
                <g
                  key={status.id}
                  className={`workflow-node ${isFocused ? "is-focused" : ""} ${isLinked ? "is-linked" : ""}`}
                  tabIndex={0}
                  role="button"
                  aria-label={`${status.name}, ${state}`}
                  onMouseEnter={() => setFocusedId(status.id)}
                  onMouseLeave={() => setFocusedId(null)}
                  onFocus={() => setFocusedId(status.id)}
                  onBlur={() => setFocusedId(null)}
                >
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={NODE_W}
                    height={NODE_H}
                    rx="12"
                    className={`workflow-node-card ${status.is_initial ? "initial" : ""}`}
                    filter={isFocused ? `url(#${shadowId})` : undefined}
                  />
                  <circle
                    cx={pos.x + 22}
                    cy={pos.y + 21}
                    r="11"
                    className="workflow-index-circle"
                  />
                  <text
                    x={pos.x + 22}
                    y={pos.y + 25}
                    textAnchor="middle"
                    className="workflow-index-text"
                  >
                    {index + 1}
                  </text>
                  <rect
                    x={pos.x + 96}
                    y={pos.y + 11}
                    width="60"
                    height="20"
                    rx="10"
                    className="workflow-state-pill"
                  />
                  <text
                    x={pos.x + 126}
                    y={pos.y + 24.5}
                    textAnchor="middle"
                    className="workflow-state-text"
                  >
                    {state}
                  </text>
                  <text x={pos.x + 14} y={pos.y + 50} className="workflow-node-name">
                    {displayName}
                  </text>
                  <text x={pos.x + 14} y={pos.y + 66} className="workflow-node-meta">
                    {status.is_initial ? "Initial stage" : "Stage"}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <style>{`
        .workflow-path-preview .workflow-edge {
          fill: none;
          stroke: #a8b0bd;
          stroke-width: 2;
          stroke-dasharray: 1 7;
          stroke-linecap: round;
          stroke-linejoin: round;
          opacity: .58;
          transition: opacity .14s ease, stroke .14s ease, stroke-width .14s ease;
        }
        .workflow-path-preview .workflow-node {
          cursor: pointer;
          outline: none;
          opacity: 1;
          transition: opacity .14s ease;
        }
        .workflow-path-preview .workflow-node-card {
          fill: #fff;
          stroke: #dde2e9;
          stroke-width: 1.3;
          transition: fill .14s ease, stroke .14s ease, stroke-width .14s ease, filter .14s ease;
        }
        .workflow-path-preview .workflow-node-card.initial {
          fill: #fff9f4;
          stroke: #f7caa9;
        }
        .workflow-path-preview .workflow-index-circle {
          fill: #f1f3f6;
          transition: fill .14s ease;
        }
        .workflow-path-preview .workflow-index-text {
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          font-size: 10px;
          font-weight: 800;
          fill: #5d6674;
        }
        .workflow-path-preview .workflow-state-pill {
          fill: #f4f6f8;
          transition: fill .14s ease;
        }
        .workflow-path-preview .workflow-state-text {
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          font-size: 9.5px;
          font-weight: 700;
          fill: #687282;
        }
        .workflow-path-preview .workflow-node-name {
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          font-size: 12.5px;
          font-weight: 700;
          fill: #181b22;
        }
        .workflow-path-preview .workflow-node-meta {
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          font-size: 10px;
          fill: #7a8390;
        }
        .workflow-path-preview .workflow-flowchart.has-focus .workflow-node {
          opacity: .16;
        }
        .workflow-path-preview .workflow-flowchart.has-focus .workflow-edge {
          opacity: .10;
        }
        .workflow-path-preview .workflow-flowchart.has-focus .workflow-node.is-focused,
        .workflow-path-preview .workflow-flowchart.has-focus .workflow-node.is-linked {
          opacity: 1;
        }
        .workflow-path-preview .workflow-flowchart.has-focus .workflow-node.is-focused .workflow-node-card {
          fill: #fff7f0;
          stroke: #f47a2a;
          stroke-width: 2;
        }
        .workflow-path-preview .workflow-flowchart.has-focus .workflow-node.is-focused .workflow-index-circle,
        .workflow-path-preview .workflow-flowchart.has-focus .workflow-node.is-focused .workflow-state-pill {
          fill: #fff0e4;
        }
        .workflow-path-preview .workflow-flowchart.has-focus .workflow-node.is-linked .workflow-node-card {
          fill: #fffaf6;
          stroke: #f7caa9;
          stroke-width: 1.8;
        }
        .workflow-path-preview .workflow-flowchart.has-focus .workflow-node.is-linked .workflow-index-circle,
        .workflow-path-preview .workflow-flowchart.has-focus .workflow-node.is-linked .workflow-state-pill {
          fill: #fff5ec;
        }
        .workflow-path-preview .workflow-flowchart.has-focus .workflow-edge.is-connected {
          opacity: 1;
          stroke: #f47a2a;
          stroke-width: 2.8;
          stroke-dasharray: 1 6;
        }
      `}</style>
    </div>
  );
}
