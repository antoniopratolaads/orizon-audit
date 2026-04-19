import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import type { Platform, BusinessType } from "@/lib/constants";

export type TemplateKind = "google-ecom" | "google-leadgen" | "meta";

export function pickTemplate(
  platform: Platform,
  businessType: BusinessType
): TemplateKind {
  if (platform === "meta") return "meta";
  return businessType === "leadgen" ? "google-leadgen" : "google-ecom";
}

function templatePath(kind: TemplateKind) {
  return path.join(process.cwd(), "src", "lib", "templates", `${kind}.xlsx`);
}

export async function loadTemplateBuffer(kind: TemplateKind): Promise<Buffer> {
  return fs.readFile(templatePath(kind));
}

/**
 * Extract the template structure — the checkpoints, slide fields, etc — so
 * we can show Claude exactly what it has to fill in. Returns a typed schema.
 */
export async function extractTemplateSchema(kind: TemplateKind) {
  const buf = await loadTemplateBuffer(kind);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(new Uint8Array(buf).buffer as ArrayBuffer);

  type CheckpointSchema = {
    section: string;
    items: { type: "AUTO" | "MANUAL"; checkpoint: string; row: number }[];
  };

  const checklist: CheckpointSchema[] = [];
  const auditWs = wb.getWorksheet("Audit");
  if (auditWs) {
    let currentSection: CheckpointSchema | null = null;
    auditWs.eachRow((row, rowNum) => {
      if (rowNum <= 2) return; // header rows
      const a = String(row.getCell(1).value ?? "").trim();
      const b = String(row.getCell(2).value ?? "").trim();
      // Detect section rows: col A is "1. Something" style and B is empty
      if (a && /^\d+\./.test(a) && !b) {
        currentSection = { section: a, items: [] };
        checklist.push(currentSection);
        return;
      }
      if ((a === "AUTO" || a === "MANUAL") && b) {
        if (!currentSection) {
          currentSection = { section: "Generale", items: [] };
          checklist.push(currentSection);
        }
        currentSection.items.push({
          type: a as "AUTO" | "MANUAL",
          checkpoint: b,
          row: rowNum,
        });
      }
    });
  }

  type KpiSchema = { metric: string; row: number; note?: string }[];
  const kpi: KpiSchema = [];
  const kpiWs = wb.getWorksheet("KPI");
  if (kpiWs) {
    kpiWs.eachRow((row, rowNum) => {
      if (rowNum <= 3) return;
      const metric = String(row.getCell(1).value ?? "").trim();
      const note = String(row.getCell(3).value ?? "").trim();
      if (metric && metric !== "KPI Account" && metric !== "Metrica") {
        kpi.push({ metric, row: rowNum, note: note || undefined });
      }
    });
  }

  type PresRow = {
    slide: string;
    field: string;
    kind: "AUTO" | "MANUAL";
    row: number;
    source?: string;
  };
  const presentation: PresRow[] = [];
  const presWs = wb.getWorksheet("Dati Presentazione");
  if (presWs) {
    let currentSlide = "";
    presWs.eachRow((row, rowNum) => {
      if (rowNum <= 3) return;
      const field = String(row.getCell(1).value ?? "").trim();
      const kind = String(row.getCell(2).value ?? "").trim();
      const source = String(row.getCell(4).value ?? "").trim();
      if (field.startsWith("Slide:")) {
        currentSlide = field.replace(/^Slide:\s*/, "");
        return;
      }
      if (field && (kind === "AUTO" || kind === "MANUAL")) {
        presentation.push({
          slide: currentSlide,
          field,
          kind: kind as "AUTO" | "MANUAL",
          row: rowNum,
          source: source || undefined,
        });
      }
    });
  }

  const hasConversioni = !!wb.getWorksheet("Conversioni");
  const hasGMC = !!wb.getWorksheet("GMC");

  return { checklist, kpi, presentation, hasConversioni, hasGMC };
}

export type TemplateSchema = Awaited<ReturnType<typeof extractTemplateSchema>>;
