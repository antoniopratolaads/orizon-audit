import ExcelJS from "exceljs";
import { loadTemplateBuffer, type TemplateKind } from "@/lib/templates";
import type { AuditData } from "@/lib/parsers/types";

function toArrayBuffer(b: Buffer): ArrayBuffer {
  return new Uint8Array(b).buffer as ArrayBuffer;
}

function setCell(ws: ExcelJS.Worksheet, row: number, col: number, val: unknown) {
  const cell = ws.getCell(row, col);
  if (val == null || val === "") {
    cell.value = null;
  } else {
    cell.value = val as ExcelJS.CellValue;
  }
}

export async function fillTemplate(
  kind: TemplateKind,
  audit: AuditData
): Promise<ExcelJS.Buffer> {
  const buf = await loadTemplateBuffer(kind);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(toArrayBuffer(buf));

  // === Legenda: header cliente ===
  const legenda = wb.getWorksheet("Legenda");
  if (legenda) {
    // Match label in col A, set col B
    legenda.eachRow((row) => {
      const label = String(row.getCell(1).value ?? "").trim().toLowerCase();
      if (label === "cliente") row.getCell(2).value = audit.header.cliente;
      else if (label === "account id")
        row.getCell(2).value = audit.header.accountId ?? "";
      else if (label === "periodo analizzato")
        row.getCell(2).value = audit.header.periodo ?? "";
      else if (label === "data audit")
        row.getCell(2).value = audit.header.dataAudit;
      else if (label === "auditor")
        row.getCell(2).value = audit.header.auditor ?? "ORIZON";
    });
  }

  // === KPI ===
  const kpiWs = wb.getWorksheet("KPI");
  if (kpiWs && audit.kpi) {
    const index = new Map<string, number>();
    kpiWs.eachRow((row, rowNum) => {
      const metric = String(row.getCell(1).value ?? "").trim();
      if (metric) index.set(metric.toLowerCase(), rowNum);
    });
    for (const k of audit.kpi) {
      const row = index.get(k.metric.toLowerCase());
      if (row) {
        kpiWs.getCell(row, 2).value = k.value;
        if (k.note) kpiWs.getCell(row, 3).value = k.note;
      }
    }
  }

  // === Audit (checklist) ===
  const auditWs = wb.getWorksheet("Audit");
  if (auditWs && audit.checklist) {
    const index = new Map<string, number>();
    auditWs.eachRow((row, rowNum) => {
      const type = String(row.getCell(1).value ?? "").trim();
      const cp = String(row.getCell(2).value ?? "").trim();
      if ((type === "AUTO" || type === "MANUAL") && cp) {
        index.set(normalizeKey(cp), rowNum);
      }
    });
    for (const c of audit.checklist) {
      const row = index.get(normalizeKey(c.checkpoint));
      if (row) {
        if (c.status) setCell(auditWs, row, 3, c.status);
        if (c.note) setCell(auditWs, row, 4, c.note);
        if (c.action) setCell(auditWs, row, 5, c.action);
      }
    }
  }

  // === Conversioni ===
  const convWs = wb.getWorksheet("Conversioni");
  if (convWs && audit.conversioni?.length) {
    // Find first empty data row (after headers)
    let startRow = 5; // typical header layout in templates
    convWs.eachRow((row, rowNum) => {
      const isHeader = String(row.getCell(1).value ?? "")
        .trim()
        .toLowerCase();
      if (isHeader === "nome azione") startRow = rowNum + 1;
    });
    audit.conversioni.forEach((c, i) => {
      const r = startRow + i;
      convWs.getCell(r, 1).value = c.name;
      convWs.getCell(r, 2).value = c.category;
      convWs.getCell(r, 3).value = c.type;
      convWs.getCell(r, 4).value = c.primary;
      convWs.getCell(r, 5).value = c.counting;
      convWs.getCell(r, 6).value = c.attribution;
      if (c.note) convWs.getCell(r, 7).value = c.note;
    });
  }

  // === GMC ===
  const gmcWs = wb.getWorksheet("GMC");
  if (gmcWs && audit.gmc) {
    const index = new Map<string, number>();
    gmcWs.eachRow((row, rowNum) => {
      const metric = String(row.getCell(1).value ?? "").trim().toLowerCase();
      if (metric) index.set(metric, rowNum);
    });
    for (const s of audit.gmc.summary ?? []) {
      const r = index.get(s.metric.toLowerCase());
      if (r) {
        gmcWs.getCell(r, 2).value = s.value;
        if (s.percent) gmcWs.getCell(r, 3).value = s.percent;
        if (s.note) gmcWs.getCell(r, 4).value = s.note;
      }
    }
    for (const s of audit.gmc.performance ?? []) {
      const r = index.get(s.metric.toLowerCase());
      if (r) {
        gmcWs.getCell(r, 2).value = s.value;
        if (s.percent) gmcWs.getCell(r, 3).value = s.percent;
        if (s.note) gmcWs.getCell(r, 4).value = s.note;
      }
    }
    // Problems table: find "Problema" header row, then write below
    let problemsStart = -1;
    gmcWs.eachRow((row, rowNum) => {
      if (String(row.getCell(1).value ?? "").trim().toLowerCase() === "problema") {
        problemsStart = rowNum + 1;
      }
    });
    if (problemsStart > 0 && audit.gmc.problems) {
      audit.gmc.problems.forEach((p, i) => {
        const r = problemsStart + i;
        gmcWs.getCell(r, 1).value = p.problem;
        gmcWs.getCell(r, 2).value = p.count;
        if (p.percent) gmcWs.getCell(r, 3).value = p.percent;
        if (p.priority) gmcWs.getCell(r, 4).value = p.priority;
      });
    }
  }

  // === Azioni ===
  const azWs = wb.getWorksheet("Azioni");
  if (azWs && audit.actions) {
    let startRow = 4;
    azWs.eachRow((row, rowNum) => {
      if (String(row.getCell(1).value ?? "").trim() === "#") {
        startRow = rowNum + 1;
      }
    });
    audit.actions.slice(0, 15).forEach((a, i) => {
      const r = startRow + i;
      azWs.getCell(r, 1).value = i + 1;
      azWs.getCell(r, 2).value = a.area;
      azWs.getCell(r, 3).value = a.action;
      azWs.getCell(r, 4).value = a.priority;
      azWs.getCell(r, 5).value = a.type;
    });
  }

  // === Dati Presentazione ===
  const presWs = wb.getWorksheet("Dati Presentazione");
  if (presWs && audit.presentation) {
    const index = new Map<string, number>();
    let currentSlide = "";
    presWs.eachRow((row, rowNum) => {
      const field = String(row.getCell(1).value ?? "").trim();
      if (field.startsWith("Slide:")) {
        currentSlide = field.replace(/^Slide:\s*/, "").trim();
        return;
      }
      const kind = String(row.getCell(2).value ?? "").trim();
      if (field && (kind === "AUTO" || kind === "MANUAL")) {
        index.set(`${currentSlide.toLowerCase()}::${field.toLowerCase()}`, rowNum);
      }
    });
    for (const p of audit.presentation) {
      const key = `${p.section.toLowerCase()}::${p.field.toLowerCase()}`;
      const r = index.get(key);
      if (r && p.value) {
        presWs.getCell(r, 3).value = p.value;
      }
    }
  }

  // === Autosize columns + wrap text + row heights ===
  autosizeWorkbook(wb);

  return wb.xlsx.writeBuffer();
}

/** Column widths (in Excel units) per sheet. Missing columns get a default. */
const COLUMN_WIDTHS: Record<string, number[]> = {
  Legenda: [32, 58],
  KPI: [34, 22, 44],
  Audit: [10, 46, 13, 62, 58],
  Conversioni: [40, 16, 18, 16, 12, 18, 48],
  GMC: [44, 18, 14, 42],
  Azioni: [5, 20, 68, 12, 11],
  "Dati Presentazione": [38, 10, 58, 22],
};

function autosizeWorkbook(wb: ExcelJS.Workbook) {
  for (const ws of wb.worksheets) {
    const widths = COLUMN_WIDTHS[ws.name] ?? [];
    // Apply column widths
    for (let i = 0; i < widths.length; i++) {
      ws.getColumn(i + 1).width = widths[i];
    }
    // For any extra columns without a preset, set a reasonable default
    for (let i = widths.length + 1; i <= ws.columnCount; i++) {
      const col = ws.getColumn(i);
      if (!col.width) col.width = 22;
    }

    // Wrap text + vertical top on every used cell, and compute row heights
    ws.eachRow((row) => {
      let maxLines = 1;
      row.eachCell({ includeEmpty: false }, (cell, colNum) => {
        const colWidth = widths[colNum - 1] ?? ws.getColumn(colNum).width ?? 22;
        const text = cellText(cell.value);
        // Merge existing alignment (headers may already be bold/centered)
        cell.alignment = {
          ...(cell.alignment ?? {}),
          wrapText: true,
          vertical: "top",
        };
        if (text) {
          // Approx: ~1.2 chars per Excel width unit, +1 for every explicit newline
          const explicitLines = text.split(/\r?\n/).length;
          const wrappedLines = text
            .split(/\r?\n/)
            .reduce(
              (acc, line) =>
                acc + Math.max(1, Math.ceil(line.length / (colWidth * 1.15))),
              0
            );
          const lines = Math.max(explicitLines, wrappedLines);
          if (lines > maxLines) maxLines = lines;
        }
      });
      // 15pt per line, capped to avoid absurdly tall rows
      if (maxLines > 1) {
        row.height = Math.min(15 * maxLines + 4, 240);
      }
    });
  }
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toLocaleDateString("it-IT");
  if (typeof v === "object") {
    if ("text" in v) return String((v as { text: unknown }).text ?? "");
    if ("richText" in v && Array.isArray((v as { richText: unknown[] }).richText)) {
      return (v as { richText: { text: string }[] }).richText
        .map((r) => r.text)
        .join("");
    }
    if ("result" in v) return cellText((v as { result: ExcelJS.CellValue }).result);
    if ("formula" in v) return String((v as { formula: unknown }).formula ?? "");
  }
  return "";
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[()]/g, "")
    .trim();
}
