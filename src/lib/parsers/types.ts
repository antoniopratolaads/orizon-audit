export type AuditStatus = "OK" | "Warning" | "Critico" | "N/A";

export type ParsedData = {
  platform: "google" | "meta";
  businessType: "ecom" | "leadgen";
  period?: { start?: string; end?: string };
  accountId?: string;
  summary: Record<string, unknown>;
  sections: Record<string, unknown>;
};

export type Checkpoint = {
  type: "AUTO" | "MANUAL";
  section: string;
  checkpoint: string;
  status?: AuditStatus | "";
  note?: string;
  action?: string;
};

export type KpiRow = { metric: string; value: string | number; note?: string };

export type ActionRow = {
  n: number;
  area: string;
  action: string;
  priority: "Alta" | "Media" | "Bassa" | "";
  type: string;
};

export type PresentationRow = {
  section: string; // Slide title
  field: string;
  kind: "AUTO" | "MANUAL";
  value: string;
  source?: string;
};

export type ConversionRow = {
  name: string;
  category: string;
  type: string;
  primary: string;
  counting: string;
  attribution: string;
  note?: string;
};

export type GmcSummaryRow = {
  metric: string;
  value: string | number;
  percent?: string;
  note?: string;
};

// The shape Claude must return, mirrors the template tabs
export type AuditData = {
  header: {
    cliente: string;
    accountId?: string;
    periodo?: string;
    dataAudit: string;
    auditor?: string;
  };
  kpi: KpiRow[];
  checklist: Checkpoint[];
  conversioni?: ConversionRow[];
  gmc?: {
    summary: GmcSummaryRow[];
    problems: { problem: string; count: string; percent?: string; priority?: string }[];
    performance: GmcSummaryRow[];
  };
  actions: ActionRow[];
  presentation: PresentationRow[];
  executiveSummary?: string;
};
