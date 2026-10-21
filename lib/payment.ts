// Payment tiers — v6 pricing (2026-10-14 spec).
//
// Numbers are unified-pool. "~videos" and "$/video" are intentionally
// NOT stored here — compute them per-row in the UI from the single cost
// table in `./pricing-table.ts`. Keeping them out of the data prevents
// the self-contradictory values the old config carried.

export type PlanType = "monthly" | "annual" | "pay-as-you-go";

export interface PaymentTier {
  id: string;
  name: string;
  price: number;
  annualPrice?: number;
  type: PlanType;
  credits: number;
  features: string[];
  popular?: boolean;
  // Entitlement differentiators — used by lib/entitlements.ts (Change 4).
  videoResolution?: "480p" | "720p" | "720p + 4K upscale" | "4K" | "8K";
  generationSpeed?: "Standard" | "Priority" | "Fastest" | "Ultra Fast";
  watermarkRemoval?: boolean;
  exclusiveModels?: boolean;
  bulkExport?: boolean;
}

// Free trial tier — display-only, 20-credit one-time grant at signup.
export const freeTrialTier: PaymentTier = {
  id: "free-trial",
  name: "Free",
  price: 0,
  type: "pay-as-you-go",
  credits: 20,
  videoResolution: "480p",
  generationSpeed: "Standard",
  watermarkRemoval: false,
  exclusiveModels: false,
  bulkExport: false,
  features: [
    "20 credits (one-time, on signup)",
    "480p resolution",
    "Watermark: waifudance.com",
    "Standard queue",
  ],
};

// Monthly subscriptions. Prices unchanged from v5; credit grants revised
// per v6 to restore the "subscription < PAYG per credit" ladder.
export const paymentTiers: PaymentTier[] = [
  {
    id: "starter",
    name: "Starter",
    price: 19,
    annualPrice: 182, // $15.2/mo × 12 (20% off)
    type: "monthly",
    credits: 600,
    videoResolution: "480p",
    generationSpeed: "Standard",
    watermarkRemoval: true,
    exclusiveModels: false,
    bulkExport: false,
    features: [
      "600 credits/month",
      "480p resolution",
      "No watermark",
      "All 20+ effects",
      "Standard queue",
      "Email support",
      "Cancel anytime",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    price: 39,
    annualPrice: 374, // $31.2/mo × 12
    type: "monthly",
    credits: 1500,
    videoResolution: "720p",
    generationSpeed: "Priority",
    watermarkRemoval: true,
    exclusiveModels: false,
    bulkExport: true,
    features: [
      "1,500 credits/month",
      "720p resolution",
      "No watermark",
      "All 20+ effects + 3 exclusive",
      "Priority queue",
      "Bulk export",
      "Email + live chat support",
      "Cancel anytime",
    ],
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: 89,
    annualPrice: 854, // $71.2/mo × 12
    type: "monthly",
    credits: 4000,
    videoResolution: "720p + 4K upscale",
    generationSpeed: "Fastest",
    watermarkRemoval: true,
    exclusiveModels: true,
    bulkExport: true,
    features: [
      "4,000 credits/month",
      "720p + 4K upscale (select effects)",
      "No watermark",
      "All effects + all exclusive",
      "Fastest (VIP) queue",
      "Bulk export",
      "API access",
      "Dedicated account manager",
      "99.5% SLA guarantee",
      "Cancel anytime",
    ],
  },
];

// Pay-As-You-Go packs — one-time, credits never expire. v6 amounts.
// Per the spec, PAYG credits do NOT unlock exclusive effects, priority
// queue, or bulk export (enforced in lib/entitlements.ts for Change 4).
export const payAsYouGoPacks: PaymentTier[] = [
  {
    id: "pack-taste",
    name: "Taste Pack",
    price: 5,
    type: "pay-as-you-go",
    credits: 120,
    videoResolution: "720p",
    generationSpeed: "Standard",
    watermarkRemoval: true,
    exclusiveModels: false,
    bulkExport: false,
    features: [
      "120 credits",
      "Full resolution access (480p + 720p)",
      "Credits never expire",
      "One-time purchase",
    ],
  },
  {
    id: "pack-casual",
    name: "Casual Pack",
    price: 10,
    type: "pay-as-you-go",
    credits: 280,
    videoResolution: "720p",
    generationSpeed: "Standard",
    watermarkRemoval: true,
    exclusiveModels: false,
    bulkExport: false,
    features: [
      "280 credits",
      "Full resolution access (480p + 720p)",
      "Credits never expire",
      "One-time purchase",
    ],
    popular: true,
  },
  {
    id: "pack-regular",
    name: "Regular Pack",
    price: 25,
    type: "pay-as-you-go",
    credits: 750,
    videoResolution: "720p",
    generationSpeed: "Standard",
    watermarkRemoval: true,
    exclusiveModels: false,
    bulkExport: false,
    features: [
      "750 credits",
      "Full resolution access (480p + 720p)",
      "Credits never expire",
      "One-time purchase",
    ],
  },
  {
    id: "pack-power",
    name: "Power Pack",
    price: 50,
    type: "pay-as-you-go",
    credits: 1600,
    videoResolution: "720p",
    generationSpeed: "Standard",
    watermarkRemoval: true,
    exclusiveModels: false,
    bulkExport: false,
    features: [
      "1,600 credits",
      "Full resolution access (480p + 720p)",
      "Credits never expire",
      "One-time purchase",
      "Best value",
    ],
  },
];

export async function createCheckoutSession(tierId: string, userId: string) {
  const response = await fetch("/api/payment/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tierId, userId }),
  });
  return response.json();
}

export async function purchaseCredits(amount: number, userId: string) {
  const response = await fetch("/api/payment/credits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, userId }),
  });
  return response.json();
}

export function getAllPlans(): PaymentTier[] {
  return [...paymentTiers, ...payAsYouGoPacks];
}

export function getPayAsYouGoPacks(): PaymentTier[] {
  return payAsYouGoPacks;
}

export function isPayAsYouGo(tier: PaymentTier): boolean {
  return tier.type === "pay-as-you-go";
}
