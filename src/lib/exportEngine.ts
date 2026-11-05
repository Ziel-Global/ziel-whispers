import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

export interface PDFExportOptions {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number | null | undefined)[][];
  filename?: string;
  orientation?: "portrait" | "landscape";
  companyName?: string;
}

export interface XLSXSheet {
  sheetName: string;
  columns: string[];
  rows: (string | number | null | undefined)[][];
}

/**
 * 1. RFC-4180 Compliant CSV Exporter with UTF-8 BOM
 */
export function exportToCSV(
  rows: Record<string, any>[],
  filename: string = "export.csv"
): void {
  if (!rows || rows.length === 0) {
    console.warn("No rows to export to CSV");
    return;
  }

  const keys = Object.keys(rows[0]);
  const headerLine = keys.map((k) => `"${k.replace(/"/g, '""')}"`).join(",");
  const dataLines = rows.map((r) =>
    keys
      .map((k) => {
        const val = r[k] ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(",")
  );

  const csvContent = "\uFEFF" + [headerLine, ...dataLines].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

/**
 * 2. Multi-Sheet Spreadsheet Exporter (XML Spreadsheet 2003 format)
 * Opens cleanly in Microsoft Excel, Google Sheets, and LibreOffice with full multiple tabs.
 */
export function exportToXLSX(
  sheets: XLSXSheet[],
  filename: string = "report.xls"
): void {
  if (!sheets || sheets.length === 0) return;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Cell">
   <Alignment ss:Vertical="Center"/>
  </Style>
 </Styles>`;

  sheets.forEach((sheet) => {
    const cleanName = (sheet.sheetName || "Sheet1").replace(/[\[\]\:\*\?\/\\]/g, "");
    xml += `\n <Worksheet ss:Name="${cleanName}">\n  <Table ss:DefaultRowHeight="20">\n   <Row ss:Height="24">`;
    sheet.columns.forEach((col) => {
      xml += `\n    <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(col)}</Data></Cell>`;
    });
    xml += `\n   </Row>`;

    sheet.rows.forEach((row) => {
      xml += `\n   <Row>`;
      row.forEach((cell) => {
        const isNum = typeof cell === "number";
        const valStr = cell !== null && cell !== undefined ? String(cell) : "";
        xml += `\n    <Cell ss:StyleID="Cell"><Data ss:Type="${isNum ? "Number" : "String"}">${escapeXml(valStr)}</Data></Cell>`;
      });
      xml += `\n   </Row>`;
    });

    xml += `\n  </Table>\n </Worksheet>`;
  });

  xml += `\n</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  downloadBlob(blob, filename.endsWith(".xls") ? filename : `${filename}.xls`);
}

/**
 * 3. High-Fidelity Branded PDF Exporter
 */
export function exportToPDF(options: PDFExportOptions): void {
  const {
    title,
    subtitle = "",
    columns,
    rows,
    filename = "report.pdf",
    orientation = "portrait",
    companyName = "Ziel Whispers • Workforce Analytics SSoT",
  } = options;

  const doc = new jsPDF({
    orientation,
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Branded Header Top Banner
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, pageWidth, 54, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 24, 28);

  // Subtitle / Company metadata
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text(`${companyName}  |  Generated: ${new Date().toLocaleString()}`, 24, 44);

  let startY = 70;
  if (subtitle) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(subtitle, 24, startY);
    startY += 18;
  }

  // Draw AutoTable
  autoTable(doc, {
    startY,
    head: [columns],
    body: rows.map((r) => r.map((c) => (c !== null && c !== undefined ? String(c) : "—"))),
    margin: { left: 24, right: 24, bottom: 40 },
    theme: "striped",
    headStyles: {
      fillColor: [59, 130, 246], // Blue-500
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "left",
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 4.5,
      textColor: [30, 41, 59],
      overflow: "linebreak",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      // Footer page numbering
      const str = `Page ${data.pageNumber} of ${(doc as any).internal.getNumberOfPages()}`;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, pageWidth - 24, pageHeight - 16, { align: "right" });
      doc.text("CONFIDENTIAL • ZIEL WORKFORCE SYSTEM", 24, pageHeight - 16);
    },
  });

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/**
 * 4. Visual Component PNG Capture
 */
export async function exportElementToImage(
  element: HTMLElement,
  filename: string = "chart.png"
): Promise<void> {
  const canvas = await html2canvas(element, { backgroundColor: "#ffffff", scale: 2 });
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  a.click();
}

// Internal helper
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

