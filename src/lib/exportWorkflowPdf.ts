import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { WorkflowStatus, WorkflowTransition } from "@/lib/workflow";

const CATEGORY_LABEL: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

function categoryLabel(category: string) {
  return CATEGORY_LABEL[category] || category.replace(/_/g, " ");
}

function safeFilename(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, "").trim().replace(/\s+/g, "-") || "workflow";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function svgElementToPng(svg: SVGSVGElement): Promise<{
  dataUrl: string;
  width: number;
  height: number;
}> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.classList.remove("has-focus");
  clone.querySelectorAll(".is-focused, .is-linked").forEach((el) => {
    el.classList.remove("is-focused", "is-linked");
  });
  const styleEl = clone.querySelector("style");
  if (styleEl) {
    styleEl.textContent = `
      .workflow-edge { fill: none; stroke: #f47a2a; stroke-width: 2.4; stroke-dasharray: 1 7; stroke-linecap: round; stroke-linejoin: round; opacity: 1; }
      .workflow-node-card { fill: #fff; stroke: #dde2e9; stroke-width: 1.3; }
      .workflow-node-card.initial { fill: #fff9f4; stroke: #f7caa9; }
      .workflow-index-circle { fill: #f1f3f6; }
      .workflow-index-text { font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 10px; font-weight: 800; fill: #5d6674; }
      .workflow-state-pill { fill: #f4f6f8; }
      .workflow-state-text { font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 9.5px; font-weight: 700; fill: #687282; }
      .workflow-node-name { font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 12.5px; font-weight: 700; fill: #181b22; }
      .workflow-node-meta { font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 10px; fill: #7a8390; }
      .flow-arrow-head { fill: #f47a2a; }
    `;
  }
  clone.querySelectorAll(".flow-arrow-head").forEach((el) => {
    el.setAttribute("fill", "#f47a2a");
  });
  clone.querySelectorAll(".workflow-edge").forEach((el) => {
    el.setAttribute("stroke", "#f47a2a");
    el.setAttribute("opacity", "1");
  });
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }

  const width = svg.width.baseVal.value || svg.viewBox.baseVal.width || 800;
  const height = svg.height.baseVal.value || svg.viewBox.baseVal.height || 390;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not render workflow graph"));
      image.src = url;
    });

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas");
    ctx.fillStyle = "#fcfcfd";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

type ExportInput = {
  name: string;
  description?: string | null;
  generatedAt?: Date;
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
  svg: SVGSVGElement | null;
};

const REPORT_CSS = `
  .wf-report {
    box-sizing: border-box;
    width: 1100px;
    padding: 28px 32px;
    background: #fff;
    color: #181b22;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
  }
  .wf-report *, .wf-report *::before, .wf-report *::after { box-sizing: border-box; }
  .wf-report-header {
    padding-bottom: 16px;
    margin-bottom: 22px;
    border-bottom: 3px solid #f47a2a;
  }
  .wf-report-title {
    margin: 0;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.2;
    color: #181b22;
  }
  .wf-report-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 4px;
    margin-top: 8px;
    font-size: 12px;
    font-weight: 500;
    color: #6f7785;
  }
  .wf-report-dot {
    display: inline-block;
    padding: 0 10px;
    color: #c3c8d0;
    font-weight: 600;
  }
  .wf-report-desc {
    margin: 10px 0 0;
    font-size: 12.5px;
    line-height: 1.45;
    color: #5d6674;
  }
  .wf-report-section { margin: 0 0 22px; }
  .wf-report-eyebrow {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #181b22;
  }
  .wf-report-card {
    background: #fff;
    border: 1px solid #e7e9ee;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(16, 24, 40, 0.06);
    padding: 16px;
  }
  .wf-report-card img {
    display: block;
    width: 100%;
    height: auto;
  }
  .wf-status-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    color: #181b22;
  }
  .wf-status-table th {
    background: #f47a2a;
    color: #fff;
    font-weight: 700;
    font-size: 9pt;
    text-align: left;
    padding: 8px;
  }
  .wf-status-table td {
    padding: 8px;
    border-bottom: 0.4pt solid #e7e9ee;
  }
  .wf-status-table tbody tr:nth-child(even) { background: #fcfcfd; }
  .wf-status-table th:first-child, .wf-status-table td:first-child { width: 64px; }
  .wf-status-table th:last-child, .wf-status-table td:last-child { width: 78px; }
  .wf-rules-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 7.5pt;
    color: #181b22;
  }
  .wf-rules-table th {
    background: #f47a2a;
    color: #fff;
    font-weight: 700;
    font-size: 7.5pt;
    text-align: center;
    padding: 6px 5px;
  }
  .wf-rules-table td {
    padding: 6px 5px;
    text-align: center;
    border-bottom: 0.4pt solid #e7e9ee;
  }
  .wf-rules-table th:first-child, .wf-rules-table td:first-child {
    text-align: left;
    font-weight: 700;
    width: 128px;
  }
  .wf-rules-table tbody tr:nth-child(even) { background: #fcfcfd; }
  .wf-rules-yes { color: #f47a2a; font-weight: 700; }
`;

function buildReportHtml(opts: {
  name: string;
  description?: string | null;
  generatedAt: Date;
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
  graphSrc: string | null;
}) {
  const title = escapeHtml(`${opts.name} - Workflow`);
  const meta = [
    "Workflow template",
    `${opts.statuses.length} status${opts.statuses.length === 1 ? "" : "es"}`,
    `Generated ${opts.generatedAt.toLocaleDateString()}`,
  ];
  const desc = opts.description?.trim()
    ? `<p class="wf-report-desc">${escapeHtml(opts.description.trim())}</p>`
    : "";

  const pathCard = opts.graphSrc
    ? `<section class="wf-report-section">
        <div class="wf-report-eyebrow">Workflow Path</div>
        <div class="wf-report-card"><img src="${opts.graphSrc}" alt="Workflow path" /></div>
      </section>`
    : "";

  const statusRows = opts.statuses
    .map(
      (s, i) => `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(categoryLabel(s.category))}</td>
        <td>${s.is_initial ? "Yes" : "No"}</td>
      </tr>`
    )
    .join("");

  const allowed = new Set(
    opts.transitions
      .filter((t) => t.from_status_id)
      .map((t) => `${t.from_status_id}->${t.to_status_id}`)
  );

  const ruleHead = `<tr><th>From \\ To</th>${opts.statuses
    .map((s) => `<th>${escapeHtml(s.name)}</th>`)
    .join("")}</tr>`;

  const ruleRows = opts.statuses
    .map((from) => {
      const cells = opts.statuses
        .map((to) => {
          if (from.id === to.id) return "<td>—</td>";
          if (allowed.has(`${from.id}->${to.id}`)) return '<td class="wf-rules-yes">Yes</td>';
          return "<td></td>";
        })
        .join("");
      return `<tr><td>${escapeHtml(from.name)}</td>${cells}</tr>`;
    })
    .join("");

  return `<div class="wf-report">
    <style>${REPORT_CSS}</style>
    <header class="wf-report-header">
      <h1 class="wf-report-title">${title}</h1>
      <div class="wf-report-meta">${meta
        .map((item, i) => `${i ? '<span class="wf-report-dot">·</span>' : ""}<span>${escapeHtml(item)}</span>`)
        .join("")}</div>
      ${desc}
    </header>
    ${pathCard}
    <section class="wf-report-section">
      <div class="wf-report-eyebrow">Statuses</div>
      <div class="wf-report-card">
        <table class="wf-status-table">
          <thead><tr><th>Order</th><th>Status</th><th>System State</th><th>Initial</th></tr></thead>
          <tbody>${statusRows}</tbody>
        </table>
      </div>
    </section>
    <section class="wf-report-section">
      <div class="wf-report-eyebrow">Transition Rules</div>
      <div class="wf-report-card">
        <table class="wf-rules-table">
          <thead>${ruleHead}</thead>
          <tbody>${ruleRows}</tbody>
        </table>
      </div>
    </section>
  </div>`;
}

async function captureElement(el: HTMLElement) {
  return html2canvas(el, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
  });
}

export async function exportWorkflowPdf({
  name,
  description,
  generatedAt = new Date(),
  statuses,
  transitions,
  svg,
}: ExportInput) {
  const graph = svg ? await svgElementToPng(svg) : null;

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-12000px;top:0;z-index:-1;";
  host.innerHTML = buildReportHtml({
    name,
    description,
    generatedAt,
    statuses,
    transitions,
    graphSrc: graph?.dataUrl ?? null,
  });
  document.body.appendChild(host);

  try {
    const graphImg = host.querySelector("img");
    if (graphImg && !graphImg.complete) {
      await new Promise<void>((resolve, reject) => {
        graphImg.onload = () => resolve();
        graphImg.onerror = () => reject(new Error("Could not load workflow graph"));
      });
    }

    const blocks = [
      host.querySelector(".wf-report-header"),
      ...Array.from(host.querySelectorAll(".wf-report-section")),
    ].filter((el): el is HTMLElement => el instanceof HTMLElement);

    const canvases = [];
    for (const block of blocks) {
      canvases.push(await captureElement(block));
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 16;
    const gap = 6;
    const contentW = pageW - margin * 2;
    const contentH = pageH - margin * 2;
    let y = margin;

    canvases.forEach((canvas, index) => {
      let drawW = contentW;
      let drawH = (canvas.height / canvas.width) * drawW;
      if (drawH > contentH) {
        drawH = contentH;
        drawW = (canvas.width / canvas.height) * drawH;
      }
      if (index > 0 && y + drawH > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      doc.addImage(canvas.toDataURL("image/png"), "PNG", margin, y, drawW, drawH);
      y += drawH + gap;
    });

    doc.save(`${safeFilename(name)}-workflow.pdf`);
  } finally {
    host.remove();
  }
}
