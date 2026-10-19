// Single source of truth for every "~N videos" and "$/video" figure
// shown on the pricing page. Keeping this in one place is what Change 3
// of the 2026-10-14 spec requires — otherwise the UI invents its own
// contradictory math.

import { CREDIT_COSTS } from "./credit-constants";

export type Resolution = "480p" | "720p";

export const CREDITS_PER_VIDEO: Record<Resolution, number> = {
  "480p": CREDIT_COSTS.VIDEO_480P, // 10
  "720p": CREDIT_COSTS.VIDEO_720P, // 19
};

/** Round-down of how many videos at a given resolution the pool buys. */
export function videosFor(credits: number, resolution: Resolution = "480p"): number {
  const cost = CREDITS_PER_VIDEO[resolution];
  if (!cost) return 0;
  return Math.floor(credits / cost);
}

/** $ per video for the pair (credits, price), at a given resolution. */
export function dollarsPerVideo(
  price: number,
  credits: number,
  resolution: Resolution = "480p"
): number | null {
  const videos = videosFor(credits, resolution);
  if (videos <= 0) return null;
  return price / videos;
}

export function fmtDollarsPerVideo(
  price: number,
  credits: number,
  resolution: Resolution = "480p"
): string {
  const v = dollarsPerVideo(price, credits, resolution);
  if (v == null) return "—";
  if (v >= 1) return `$${v.toFixed(2)}/video`;
  return `$${v.toFixed(2).replace(/\.?0+$/, "")}/video`;
}
