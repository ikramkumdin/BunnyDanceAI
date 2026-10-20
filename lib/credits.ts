import { adminDb } from "./firebase-admin";
import { User } from "@/types";
import {
  CREDIT_COSTS,
  FREE_IMAGE_CREDITS,
  FREE_VIDEO_CREDITS,
  FREE_SIGNUP_CREDITS,
} from "./credit-constants";
export { CREDIT_COSTS, FREE_IMAGE_CREDITS, FREE_VIDEO_CREDITS, FREE_SIGNUP_CREDITS };

// v6 unified credit model (2026-10-14 spec)
//
//   credits      — granted by a subscription (resets each billing period)
//   paygCredits  — purchased one-time, never expires
//
// Spend order: subscription credits first (so they don't age), PAYG last.
// Legacy image/video pools are READ for backward compatibility (effective
// = unified + imageCredits + videoCredits) until the one-shot backfill
// consolidates them, then those fields can be dropped.

export type CreditSource = "subscription" | "payg" | "signup";

/** Total credits the user can spend right now (unified + legacy pools). */
export function effectiveBalance(user: Partial<User>): number {
  return (user.credits ?? 0) + (user.paygCredits ?? 0) + (user.imageCredits ?? 0) + (user.videoCredits ?? 0);
}

/**
 * Does the user have at least `cost` credits? `cost` can be a number
 * (preferred, from CREDIT_COSTS) or a legacy "image" | "video" string
 * which this function maps for compatibility.
 */
export async function hasCredits(
  userId: string,
  cost: number | "image" | "video"
): Promise<boolean> {
  try {
    const snap = await adminDb.collection("users").doc(userId).get();
    if (!snap.exists) return false;
    const user = snap.data() as User;
    const n = typeof cost === "number" ? cost : (cost === "image" ? CREDIT_COSTS.IMAGE : CREDIT_COSTS.VIDEO);
    return effectiveBalance(user) >= n;
  } catch (err) {
    console.error("hasCredits error:", err);
    return false;
  }
}

/**
 * Deduct `cost` credits atomically — subscription credits first, then PAYG,
 * then whatever is left in legacy pools (image first, video second).
 * Returns true if the deduction committed.
 */
export async function deductCredit(
  userId: string,
  cost: number | "image" | "video"
): Promise<boolean> {
  try {
    const userRef = adminDb.collection("users").doc(userId);
    const snap = await userRef.get();
    if (!snap.exists) return false;
    const user = snap.data() as User;

    let remaining = typeof cost === "number"
      ? cost
      : (cost === "image" ? CREDIT_COSTS.IMAGE : CREDIT_COSTS.VIDEO);
    if (effectiveBalance(user) < remaining) return false;

    const update: Record<string, number> = {};
    let credits = user.credits ?? 0;
    let paygCredits = user.paygCredits ?? 0;
    let imageCredits = user.imageCredits ?? 0;
    let videoCredits = user.videoCredits ?? 0;

    const take = (from: number): number => {
      const t = Math.min(from, remaining);
      remaining -= t;
      return from - t;
    };

    credits      = take(credits);
    paygCredits  = take(paygCredits);
    imageCredits = take(imageCredits);
    videoCredits = take(videoCredits);

    update.credits      = credits;
    update.paygCredits  = paygCredits;
    update.imageCredits = imageCredits;
    update.videoCredits = videoCredits;

    await userRef.update(update);
    return true;
  } catch (err) {
    console.error("deductCredit error:", err);
    return false;
  }
}

/** Credits summary for display. */
export async function getRemainingCredits(userId: string): Promise<{
  credits: number;
  paygCredits: number;
  total: number;
  // Legacy fields for existing callers (returns the raw stored values).
  imageCredits: number;
  videoCredits: number;
}> {
  try {
    const snap = await adminDb.collection("users").doc(userId).get();
    if (!snap.exists) {
      return { credits: 0, paygCredits: 0, total: 0, imageCredits: 0, videoCredits: 0 };
    }
    const user = snap.data() as User;
    return {
      credits: user.credits ?? 0,
      paygCredits: user.paygCredits ?? 0,
      total: effectiveBalance(user),
      imageCredits: user.imageCredits ?? 0,
      videoCredits: user.videoCredits ?? 0,
    };
  } catch (err) {
    console.error("getRemainingCredits error:", err);
    return { credits: 0, paygCredits: 0, total: 0, imageCredits: 0, videoCredits: 0 };
  }
}

/**
 * Add credits to the user.
 *
 * New signature (preferred):   addCredits(userId, amount, source)
 * Legacy signature kept too:   addCredits(userId, imageCredits, videoCredits)
 *   — the sum of the two is written to the appropriate v6 bucket.
 *     Subscription webhooks pass source='subscription'; PAYG purchases
 *     pass 'payg'; signup grants pass 'signup' (goes to subscription-pool
 *     side because it refreshes semantics-wise, not never-expires).
 */
export async function addCredits(
  userId: string,
  amountOrImageCredits: number,
  sourceOrVideoCredits: CreditSource | number = "subscription"
): Promise<boolean> {
  try {
    const userRef = adminDb.collection("users").doc(userId);
    const snap = await userRef.get();
    if (!snap.exists) return false;
    const user = snap.data() as User;

    // Detect which signature was used.
    const legacySignature = typeof sourceOrVideoCredits === "number";
    const amount = legacySignature
      ? amountOrImageCredits + (sourceOrVideoCredits as number)
      : amountOrImageCredits;
    const source: CreditSource = legacySignature
      ? "subscription"
      : (sourceOrVideoCredits as CreditSource);

    if (amount <= 0) return true;

    const update: Record<string, number> = {};
    if (source === "payg") {
      update.paygCredits = (user.paygCredits ?? 0) + amount;
    } else {
      update.credits = (user.credits ?? 0) + amount;
    }

    await userRef.update(update);
    return true;
  } catch (err) {
    console.error("addCredits error:", err);
    return false;
  }
}
