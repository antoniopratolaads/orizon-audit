import ExcelJS from "exceljs";
import type { ParsedData } from "./types";

function cellVal(v: unknown): string | number | null {
  if (v == null) return null;
  if (typeof v === "object" && v !== null) {
    // ExcelJS returns richText / hyperlink objects
    if ("text" in v) return String((v as { text: unknown }).text ?? "");
    if ("richText" in v && Array.isArray((v as { richText: unknown[] }).richText)) {
      return (v as { richText: { text: string }[] }).richText
        .map((r) => r.text)
        .join("");
    }
    if ("result" in v) return cellVal((v as { result: unknown }).result);
    if ("hyperlink" in v) return String((v as { text?: unknown; hyperlink: unknown }).text ?? "");
    if (v instanceof Date) return v.toISOString();
  }
  if (typeof v === "number" || typeof v === "string") return v;
  return String(v);
}

function sheetToObjects(ws: ExcelJS.Worksheet, headerRow = 1) {
  const header: string[] = [];
  ws.getRow(headerRow).eachCell((cell, col) => {
    header[col] = String(cellVal(cell.value) ?? `col${col}`).trim();
  });
  const rows: Record<string, unknown>[] = [];
  ws.eachRow((row, rowNum) => {
    if (rowNum <= headerRow) return;
    const obj: Record<string, unknown> = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const key = header[col];
      if (!key) return;
      const val = cellVal(cell.value);
      obj[key] = val;
      if (val !== null && val !== "") hasValue = true;
    });
    if (hasValue) rows.push(obj);
  });
  return rows;
}

function sheetKeyValuePairs(ws: ExcelJS.Worksheet) {
  const out: Record<string, string | number | null> = {};
  ws.eachRow((row) => {
    const k = cellVal(row.getCell(1).value);
    const v = cellVal(row.getCell(2).value);
    if (k && typeof k === "string" && k.trim()) {
      out[k.trim()] = v;
    }
  });
  return out;
}

const LIMIT_ROWS = 200;

export async function parseGoogleAdsXlsx(
  buffer: ArrayBuffer,
  businessType: "ecom" | "leadgen"
): Promise<ParsedData> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const sections: Record<string, unknown> = {};

  // Riepilogo — key/value pairs
  const ws = wb.getWorksheet("Riepilogo");
  if (ws) sections.Riepilogo = sheetKeyValuePairs(ws);

  const tabs = [
    "Campagne Attive",
    "Campagne in Pausa",
    "Keyword + QS",
    "Search Terms",
    "Annunci",
    "RSA Dettaglio",
    "Estensioni",
    "Conversioni",
    "Per Device",
    "Per Geo",
    "Per Giorno-Ora",
    "Ad Schedule",
    "Trend Settimanale",
    "Trend Mensile YoY",
    "Change History",
    "Audience Lists",
    "Recommendations",
    "PMax Asset",
    "PMax Signals",
    "GMC Diagnostica",
    "GMC Riepilogo",
    "Prodotti",
  ];

  for (const name of tabs) {
    const s = wb.getWorksheet(name);
    if (!s) continue;
    if (name === "GMC Riepilogo") {
      sections[name] = sheetKeyValuePairs(s);
    } else {
      const rows = sheetToObjects(s);
      // Cap very large tabs (Search Terms, Prodotti, Per Giorno-Ora, GMC Diagnostica, PMax Asset)
      sections[name] = rows.slice(0, LIMIT_ROWS);
      if (rows.length > LIMIT_ROWS) {
        (sections[`${name}_meta`] as unknown) = {
          truncated: true,
          totalRows: rows.length,
          shown: LIMIT_ROWS,
        };
      }
    }
  }

  const summary = (sections.Riepilogo ?? {}) as Record<string, unknown>;
  return {
    platform: "google",
    businessType,
    accountId: String(summary["Account ID"] ?? "") || undefined,
    period: extractPeriod(String(summary["Periodo"] ?? "")),
    summary,
    sections,
  };
}

function extractPeriod(s: string): { start?: string; end?: string } | undefined {
  if (!s) return undefined;
  const m = s.match(/(\d{4}-\d{2}-\d{2}).*?(\d{4}-\d{2}-\d{2})/);
  if (m) return { start: m[1], end: m[2] };
  return undefined;
}
