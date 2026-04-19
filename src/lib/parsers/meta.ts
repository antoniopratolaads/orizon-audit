import Papa from "papaparse";
import type { ParsedData } from "./types";

type Row = Record<string, string>;

export async function parseMetaCsv(
  text: string,
  businessType: "ecom" | "leadgen"
): Promise<ParsedData> {
  const parsed = Papa.parse<Row>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rows = (parsed.data ?? []).filter(
    (r) => r && Object.keys(r).length > 1
  );

  const periodStart = rows[0]?.["Reporting starts"];
  const periodEnd = rows[0]?.["Reporting ends"];

  // Aggregations
  const toNum = (v: string | undefined) =>
    v == null || v === "" ? 0 : Number.parseFloat(String(v).replace(",", ".")) || 0;

  const totals = {
    spent: 0,
    impressions: 0,
    reach: 0,
    reachRaw: 0, // naive sum of per-row reach (overcounts — not user-facing)
    reachMax: 0, // highest single-row reach (proxy for unique audience)
    freqWeightedSum: 0, // Σ(frequency_row × impressions_row)
    clicks: 0,
    purchases: 0,
    leads: 0,
    atc: 0,
    checkouts: 0,
    contentViews: 0,
    landingViews: 0,
    purchaseValue: 0,
    videoPlays3s: 0, // for hook rate
    videoPlays15s: 0, // for hold rate (or ThruPlays)
    thruPlays: 0,
    // If Meta exports Hook/Hold rate directly, compute weighted avg
    hookRateWeightedSum: 0,
    holdRateWeightedSum: 0,
    hasDirectHookRate: false,
    hasDirectHoldRate: false,
    attributionWindow: "" as string,
  };
  const byCampaign = new Map<string, Row[]>();
  const byAdset = new Map<string, Row[]>();
  const byPlacement = new Map<
    string,
    {
      spend: number;
      impressions: number;
      clicks: number;
      purchases: number;
      leads: number;
    }
  >();

  // Helper: pick value from any of several possible column names
  const pick = (r: Row, keys: string[]): string | undefined => {
    for (const k of keys) if (r[k] != null && r[k] !== "") return r[k];
    return undefined;
  };
  const pickNum = (r: Row, keys: string[]) => toNum(pick(r, keys));

  // Detect attribution window from column names on first pass
  for (const r of rows) {
    for (const key of Object.keys(r)) {
      const m = key.match(
        /\((\d+-day click[^)]*|\d+-day view[^)]*|\d+d? click[^)]*|[17]d[\s_-]?1d)\)/i
      );
      if (m) {
        totals.attributionWindow = m[1];
        break;
      }
    }
    if (totals.attributionWindow) break;
  }

  for (const r of rows) {
    const spend = toNum(r["Amount spent (EUR)"]);
    const clicks = toNum(r["Link clicks"]);
    const impressions = toNum(r["Impressions"]);
    const reach = toNum(r["Reach"]);
    const frequency = toNum(r["Frequency"]);
    const resultType = r["Result type"] ?? "";
    const results = toNum(r["Results"]);
    const purchases = toNum(r["Purchases"]);
    const atc = toNum(r["Adds to cart"]);
    const checkouts = toNum(r["Checkouts initiated"]);
    const contentViews = toNum(r["Content views"]);
    const landingViews = toNum(r["Landing page views"]);
    const roas = toNum(r["Purchase ROAS (return on ad spend)"]);
    const purchaseValue = roas && spend ? roas * spend : 0;

    // Video metrics for Hook Rate / Hold Rate
    const videoPlays3s = pickNum(r, [
      "Video plays at 3 seconds",
      "3-second video plays",
      "3-Second Video Plays",
    ]);
    const videoPlays15s = pickNum(r, [
      "Video plays at 15 seconds",
      "15-second video plays",
      "15-Second Video Plays",
    ]);
    const thruPlays = pickNum(r, [
      "ThruPlays",
      "Thruplays",
      "Thru plays",
    ]);
    // If Meta exports Hook Rate / Hold Rate directly as percentages
    const hookRateCell = pick(r, [
      "Hook rate",
      "Hook Rate",
      "Video hook rate",
    ]);
    const holdRateCell = pick(r, [
      "Hold rate",
      "Hold Rate",
      "Video hold rate",
    ]);

    totals.spent += spend;
    totals.impressions += impressions;
    totals.reachRaw += reach;
    if (reach > totals.reachMax) totals.reachMax = reach;
    if (frequency > 0 && impressions > 0) {
      totals.freqWeightedSum += frequency * impressions;
    }
    totals.videoPlays3s += videoPlays3s;
    totals.videoPlays15s += videoPlays15s;
    totals.thruPlays += thruPlays;
    if (hookRateCell !== undefined) {
      const hr = parsePct(hookRateCell);
      if (hr > 0 && impressions > 0) {
        totals.hookRateWeightedSum += hr * impressions;
        totals.hasDirectHookRate = true;
      }
    }
    if (holdRateCell !== undefined) {
      const hdr = parsePct(holdRateCell);
      if (hdr > 0 && impressions > 0) {
        totals.holdRateWeightedSum += hdr * impressions;
        totals.hasDirectHoldRate = true;
      }
    }
    totals.clicks += clicks;
    totals.purchases += purchases;
    totals.atc += atc;
    totals.checkouts += checkouts;
    totals.contentViews += contentViews;
    totals.landingViews += landingViews;
    totals.purchaseValue += purchaseValue;
    if (resultType.toLowerCase().includes("lead")) totals.leads += results;

    const cname = r["Campaign name"] || "—";
    const aname = r["Ad set name"] || "—";
    if (!byCampaign.has(cname)) byCampaign.set(cname, []);
    byCampaign.get(cname)!.push(r);
    if (!byAdset.has(aname)) byAdset.set(aname, []);
    byAdset.get(aname)!.push(r);

    const pl = r["Placement"] || "—";
    const cur = byPlacement.get(pl) ?? {
      spend: 0,
      impressions: 0,
      clicks: 0,
      purchases: 0,
      leads: 0,
    };
    cur.spend += spend;
    cur.impressions += impressions;
    cur.clicks += clicks;
    cur.purchases += purchases;
    if (resultType.toLowerCase().includes("lead")) cur.leads += results;
    byPlacement.set(pl, cur);
  }

  const campaigns = Array.from(byCampaign.entries())
    .map(([name, adRows]) => {
      const c = {
        name,
        spend: 0,
        impressions: 0,
        clicks: 0,
        purchases: 0,
        purchaseValue: 0,
        leads: 0,
        activeAds: 0,
        totalAds: adRows.length,
      };
      for (const r of adRows) {
        c.spend += toNum(r["Amount spent (EUR)"]);
        c.impressions += toNum(r["Impressions"]);
        c.clicks += toNum(r["Link clicks"]);
        c.purchases += toNum(r["Purchases"]);
        const roas = toNum(r["Purchase ROAS (return on ad spend)"]);
        const spend = toNum(r["Amount spent (EUR)"]);
        c.purchaseValue += roas && spend ? roas * spend : 0;
        if ((r["Delivery status"] ?? "").toLowerCase() === "active") c.activeAds++;
        if ((r["Result type"] ?? "").toLowerCase().includes("lead"))
          c.leads += toNum(r["Results"]);
      }
      return {
        ...c,
        roas: c.spend ? c.purchaseValue / c.spend : 0,
        cpa: c.purchases ? c.spend / c.purchases : 0,
        cpl: c.leads ? c.spend / c.leads : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  const placements = Array.from(byPlacement.entries())
    .map(([name, v]) => ({
      name,
      ...v,
      ctr: v.impressions ? (v.clicks / v.impressions) * 100 : 0,
    }))
    .sort((a, b) => b.spend - a.spend);

  // Creative / formats (very simplistic based on ad name)
  const formatCount: Record<string, number> = {};
  for (const r of rows) {
    const ad = (r["Ad name"] ?? "").toLowerCase();
    let fmt = "altro";
    if (/car(osel|ousel)|carosell/.test(ad)) fmt = "carosello";
    else if (/\bvid|video|reels?\b/.test(ad)) fmt = "video";
    else if (/\bcol(l)?ection/.test(ad)) fmt = "collection";
    else if (/\bimg|static|img_|statica/.test(ad)) fmt = "statica";
    else if (/\bdyn|dynamic/.test(ad)) fmt = "dynamic";
    formatCount[fmt] = (formatCount[fmt] ?? 0) + 1;
  }

  const ROW_CAP = 300;
  const adsTop = [...rows]
    .sort(
      (a, b) => toNum(b["Amount spent (EUR)"]) - toNum(a["Amount spent (EUR)"])
    )
    .slice(0, ROW_CAP);

  return {
    platform: "meta",
    businessType,
    period:
      periodStart || periodEnd
        ? { start: periodStart, end: periodEnd }
        : undefined,
    summary: (() => {
      const frequency =
        totals.impressions > 0 && totals.freqWeightedSum > 0
          ? totals.freqWeightedSum / totals.impressions
          : 0;
      const reach =
        frequency > 0 ? Math.round(totals.impressions / frequency) : 0;

      // Hook Rate: prefer direct value from CSV (weighted avg), else
      // compute from video plays at 3 seconds / impressions
      const hookRate = totals.hasDirectHookRate
        ? totals.hookRateWeightedSum / totals.impressions
        : totals.impressions > 0 && totals.videoPlays3s > 0
          ? (totals.videoPlays3s / totals.impressions) * 100
          : 0;

      // Hold Rate: direct weighted avg, else use 15s plays (or ThruPlays
      // as fallback) over 3s plays (best indicator of content retention)
      // or over impressions if 3s not available
      let holdRate = 0;
      if (totals.hasDirectHoldRate) {
        holdRate = totals.holdRateWeightedSum / totals.impressions;
      } else if (totals.videoPlays15s > 0) {
        const denom = totals.videoPlays3s || totals.impressions;
        holdRate = (totals.videoPlays15s / denom) * 100;
      } else if (totals.thruPlays > 0) {
        const denom = totals.videoPlays3s || totals.impressions;
        holdRate = (totals.thruPlays / denom) * 100;
      }

      const hasVideoMetrics =
        totals.videoPlays3s > 0 ||
        totals.videoPlays15s > 0 ||
        totals.thruPlays > 0 ||
        totals.hasDirectHookRate ||
        totals.hasDirectHoldRate;

      return {
        ...totals,
        reach,
        frequency,
        hookRate,
        holdRate,
        hasVideoMetrics,
        roas: totals.spent ? totals.purchaseValue / totals.spent : 0,
        cpa: totals.purchases ? totals.spent / totals.purchases : 0,
        cpl: totals.leads ? totals.spent / totals.leads : 0,
        ctrLink: totals.impressions
          ? (totals.clicks / totals.impressions) * 100
          : 0,
        cpcLink: totals.clicks ? totals.spent / totals.clicks : 0,
        adsTotal: rows.length,
        campaignsTotal: byCampaign.size,
        adsetsTotal: byAdset.size,
        formats: formatCount,
      };
    })(),
    sections: {
      campaigns,
      placements,
      adsTop,
    },
  };
}

/** Parse a percentage cell like "12.3%" or "12.3" or "0.123" into a percent value. */
function parsePct(v: string): number {
  const cleaned = String(v).trim().replace("%", "").replace(",", ".");
  const n = parseFloat(cleaned);
  if (isNaN(n)) return 0;
  // If value looks like 0.XX (ratio), convert to percent
  return n <= 1 ? n * 100 : n;
}
