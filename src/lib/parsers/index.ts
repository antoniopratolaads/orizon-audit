import { parseGoogleAdsXlsx } from "./google-ads";
import { parseMetaCsv } from "./meta";
import type { ParsedData } from "./types";

export async function parseUpload(
  platform: "google" | "meta",
  businessType: "ecom" | "leadgen",
  file: File
): Promise<ParsedData> {
  if (platform === "google") {
    const buf = await file.arrayBuffer();
    return parseGoogleAdsXlsx(buf, businessType);
  }
  const text = await file.text();
  return parseMetaCsv(text, businessType);
}

export { parseGoogleAdsXlsx, parseMetaCsv };
export type { ParsedData };
