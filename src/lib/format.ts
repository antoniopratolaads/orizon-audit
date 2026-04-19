export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .padEnd(1, "?");
}

// Deterministic color from name for avatar background
export function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

export function avatarStyle(name: string): React.CSSProperties {
  const hue = hueFromString(name);
  return {
    backgroundColor: `oklch(0.92 0.05 ${hue})`,
    color: `oklch(0.35 0.18 ${hue})`,
  };
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function platformLabel(p: string): string {
  if (p === "google") return "Google Ads";
  if (p === "meta") return "Meta Ads";
  return p;
}

export function businessLabel(b: string): string {
  if (b === "ecom") return "E-commerce";
  if (b === "leadgen") return "Lead Gen";
  return b;
}

export function num(n: number | string | null | undefined): string {
  if (n == null || n === "") return "—";
  const v = typeof n === "string" ? parseFloat(n.replace(",", ".")) : n;
  if (isNaN(v as number)) return String(n);
  return (v as number).toLocaleString("it-IT");
}

export function currency(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}
