// Credit constants — safe to import on both client and server
// (no firebase-admin here).
//
// v6 model (2026-10-14 spec): one unified credit pool. Legacy constants
// kept as re-exports to avoid breaking old call sites during migration.

// Free tier: one-time grant on first Firestore user-doc creation.
// No monthly refill (there never was a cron for that; the "monthly" claim
// in old copy was aspirational).
export const FREE_SIGNUP_CREDITS = 20;

// Per-generation costs — unified pool, charged per resolution.
export const CREDIT_COSTS = {
  IMAGE: 1,
  VIDEO_480P: 10,
  VIDEO_720P: 19,
  // Backward-compat: the old `VIDEO` constant mapped to 20. The 720p
  // cost (19) is the closer and more conservative replacement.
  VIDEO: 19,
} as const;

export type ResolutionKey = "480p" | "720p";
export function videoCost(resolution: ResolutionKey = "480p"): number {
  return resolution === "720p" ? CREDIT_COSTS.VIDEO_720P : CREDIT_COSTS.VIDEO_480P;
}

// ─── Legacy exports kept so existing imports keep compiling. Remove once
// every call site has moved to FREE_SIGNUP_CREDITS. ────────────────────
export const FREE_IMAGE_CREDITS = FREE_SIGNUP_CREDITS;
export const FREE_VIDEO_CREDITS = 0;
