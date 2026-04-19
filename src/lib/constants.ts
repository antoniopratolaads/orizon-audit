export const PLATFORMS = {
  google: { label: "Google Ads", value: "google" },
  meta: { label: "Meta Ads", value: "meta" },
} as const;

export const BUSINESS_TYPES = {
  ecom: { label: "E-commerce", value: "ecom" },
  leadgen: { label: "Lead Generation", value: "leadgen" },
} as const;

export type Platform = keyof typeof PLATFORMS;
export type BusinessType = keyof typeof BUSINESS_TYPES;

export const STATUS_LABELS = {
  OK: "OK",
  Warning: "Warning",
  Critico: "Critico",
  "N/A": "N/A",
} as const;

export type AuditStatus = keyof typeof STATUS_LABELS;

export const DEFAULT_PROMPTS = {
  googleEcom: `Sei un esperto di Google Ads per e-commerce. Analizzi i dati di un account Google Ads estratti da uno script e compili un audit strutturato in italiano.

Per ogni checkpoint di tipo AUTO, assegna uno Status tra: OK, Warning, Critico, N/A.
- OK: configurato correttamente
- Warning: migliorabile, azione consigliata
- Critico: problema serio, azione urgente
- N/A: non applicabile dai dati

Per ogni checkpoint, scrivi:
- "note": una breve nota tecnica (1-3 frasi) con i numeri chiave osservati
- "azione": azione consigliata diretta (1 frase)

Alla fine compila anche:
- Azioni Prioritarie (top 10 azioni ordinate per priorità)
- Considerazioni per i campi "Insight" delle slide presentazione

Stile: tono diretto, tecnico, numeri sempre. Zero fluff. Italiano.`,
  googleLeadgen: `Sei un esperto di Google Ads per lead generation. Analizzi i dati di un account Google Ads e compili un audit in italiano.

Stesse regole di scoring (OK, Warning, Critico, N/A) e output structure (note, azione per ogni checkpoint + Azioni Prioritarie + Considerazioni).

Focus: CPA, qualità lead, OCT, landing page, form. Tono diretto e tecnico.`,
  meta: `Sei un esperto di Meta Ads. Analizzi i dati di un account Meta Ads (export CSV livello campaign/adset/ad × placement) e compili un audit in italiano.

Stesse regole di scoring (OK, Warning, Critico, N/A) e output structure (note, azione per ogni checkpoint + Azioni Prioritarie + Considerazioni).

Focus: frequenza, creative, placement, audience, retargeting, CAPI/Pixel, attribution. Tono diretto, numeri sempre, italiano.`,
} as const;

export const NAV_ITEMS = [
  { href: "/", label: "Home", iconName: "LayoutDashboard" as const },
  { href: "/audits", label: "Audit", iconName: "FileSpreadsheet" as const },
  { href: "/clients", label: "Clienti", iconName: "Users" as const },
  { href: "/settings", label: "Settings", iconName: "Settings" as const },
] as const;
