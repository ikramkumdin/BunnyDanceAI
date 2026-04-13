// Payment integration utilities
// This file contains helper functions for Stripe/Lemon integration

export interface PaymentTier {
  id: string;
  name: string;
  price: number;
  annualPrice?: number; // Annual price with 20% discount
  type: 'monthly' | 'annual' | 'pay-as-you-go';
  credits: number; // Total credits (same for images and videos)
  imageCredits: number; // Image credits per month/pack
  videoCredits: number; // Video credits per month/pack (20 credits = 1 video)
  videosPerMonth: number; // Approximate videos (videoCredits / 20)
  perVideoCost: number;
  annualPerVideoCost?: number;
  features: string[];
  popular?: boolean; // Mark popular plan
  // Feature differentiation
  videoResolution?: 'HD' | '480p' | '720p' | '720p + 4K upscale' | '4K' | '8K';
  generationSpeed?: 'Standard' | 'Priority' | 'Fastest' | 'Ultra Fast';
  watermarkRemoval?: boolean;
  exclusiveModels?: boolean;
}

// Free trial tier (display-only, no checkout needed)
export const freeTrialTier: PaymentTier = {
  id: 'free-trial',
  name: 'Free',
  price: 0,
  type: 'pay-as-you-go',
  credits: 20,
  imageCredits: 20,
  videoCredits: 20, // 20 credits = ~1-2 videos
  videosPerMonth: 1,
  perVideoCost: 0,
  videoResolution: '480p',
  generationSpeed: 'Standard',
  watermarkRemoval: false,
  exclusiveModels: false,
  features: [
    '20 credits (one-time, on signup)',
    '480p resolution only',
    '1 video (6 sec)',
    'Watermark: waifudance.com',
    'Standard speed',
    'No payment required',
  ],
};

// Subscription plans
// Cost basis: $0.005/credit, ~10 credits/480p video, ~18 credits/720p video
export const paymentTiers: PaymentTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 19,
    annualPrice: 182, // $15.2/mo × 12
    type: 'monthly',
    credits: 150,
    imageCredits: 150,
    videoCredits: 150,
    videosPerMonth: 15, // ~15 at 480p, ~8 at 720p
    perVideoCost: 1.27,
    annualPerVideoCost: 1.01,
    videoResolution: '480p',
    generationSpeed: 'Standard',
    watermarkRemoval: true,
    exclusiveModels: false,
    features: [
      '150 credits/month',
      '~15 videos (480p) or ~8 videos (720p)',
      '480p resolution',
      'No watermark',
      'All 20+ effects',
      'Standard generation speed',
      'Email support',
      'Cancel anytime',
    ],
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 39,
    annualPrice: 374, // $31.2/mo × 12
    type: 'monthly',
    credits: 280,
    imageCredits: 280,
    videoCredits: 280,
    videosPerMonth: 15, // ~15 at 720p
    perVideoCost: 2.60,
    annualPerVideoCost: 2.08,
    videoResolution: '720p',
    generationSpeed: 'Priority',
    watermarkRemoval: true,
    exclusiveModels: false,
    features: [
      '280 credits/month',
      '~15 videos at 720p',
      '720p resolution',
      'No watermark',
      'All 20+ effects + 3 exclusive',
      'Priority queue',
      'Bulk export (up to 10)',
      'Email + live chat support',
      'Cancel anytime',
    ],
    popular: true, // Mark as popular
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 89,
    annualPrice: 854, // $71.2/mo × 12
    type: 'monthly',
    credits: 650,
    imageCredits: 650,
    videoCredits: 650,
    videosPerMonth: 36, // ~36 at 720p
    perVideoCost: 2.47,
    annualPerVideoCost: 1.98,
    videoResolution: '720p + 4K upscale',
    generationSpeed: 'Fastest',
    watermarkRemoval: true,
    exclusiveModels: true,
    features: [
      '650 credits/month',
      '~36 videos at 720p',
      '720p + 4K upscale (select effects)',
      'No watermark',
      'All effects + all exclusive',
      'Fastest (VIP) queue',
      'Bulk export (up to 50)',
      'API access',
      'Dedicated account manager',
      '99.5% SLA guarantee',
      'Cancel anytime',
    ],
  },
];

// Pay-As-You-Go Credit Packs (one-time purchases)
// Credits never expire. All packs include access to full effect library (no tier restrictions).
export const payAsYouGoPacks: PaymentTier[] = [
  {
    id: 'pack-taste',
    name: 'Taste',
    price: 5,
    type: 'pay-as-you-go',
    credits: 500,
    imageCredits: 500,
    videoCredits: 500,
    videosPerMonth: 52, // ~52 at 480p, ~27 at 720p
    perVideoCost: 0.010,
    videoResolution: '720p',
    generationSpeed: 'Standard',
    watermarkRemoval: true,
    exclusiveModels: false,
    features: [
      '500 credits',
      '~52 videos (480p) or ~27 videos (720p)',
      'Full effect library',
      'Credits never expire',
      'One-time purchase',
    ],
  },
  {
    id: 'pack-casual',
    name: 'Casual',
    price: 10,
    type: 'pay-as-you-go',
    credits: 1200,
    imageCredits: 1200,
    videoCredits: 1200,
    videosPerMonth: 145, // ~145 at 480p, ~77 at 720p
    perVideoCost: 0.0083,
    videoResolution: '720p',
    generationSpeed: 'Standard',
    watermarkRemoval: true,
    exclusiveModels: false,
    features: [
      '1,200 credits',
      '~145 videos (480p) or ~77 videos (720p)',
      'Full effect library',
      'Credits never expire',
      'One-time purchase',
    ],
    popular: true,
  },
  {
    id: 'pack-regular',
    name: 'Regular',
    price: 25,
    type: 'pay-as-you-go',
    credits: 3000,
    imageCredits: 3000,
    videoCredits: 3000,
    videosPerMonth: 364, // ~364 at 480p, ~194 at 720p
    perVideoCost: 0.0083,
    videoResolution: '720p',
    generationSpeed: 'Standard',
    watermarkRemoval: true,
    exclusiveModels: false,
    features: [
      '3,000 credits',
      '~364 videos (480p) or ~194 videos (720p)',
      'Full effect library',
      'Credits never expire',
      'One-time purchase',
    ],
  },
  {
    id: 'pack-power',
    name: 'Power',
    price: 50,
    type: 'pay-as-you-go',
    credits: 7500,
    imageCredits: 7500,
    videoCredits: 7500,
    videosPerMonth: 885, // ~885 at 480p, ~472 at 720p
    perVideoCost: 0.0067,
    videoResolution: '720p',
    generationSpeed: 'Standard',
    watermarkRemoval: true,
    exclusiveModels: true,
    features: [
      '7,500 credits',
      '~885 videos (480p) or ~472 videos (720p)',
      'Full effect library',
      'Credits never expire',
      'One-time purchase',
      'Best value',
    ],
  },
];

export async function createCheckoutSession(tierId: string, userId: string) {
  // Implement Stripe checkout session creation
  // This would call your backend API
  const response = await fetch('/api/payment/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tierId, userId }),
  });
  
  return response.json();
}

export async function purchaseCredits(amount: number, userId: string) {
  // Implement credit purchase
  const response = await fetch('/api/payment/credits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, userId }),
  });
  
  return response.json();
}

// Get all available plans (subscriptions + pay-as-you-go)
export function getAllPlans(): PaymentTier[] {
  return [...paymentTiers, ...payAsYouGoPacks];
}

// Get pay-as-you-go packs only
export function getPayAsYouGoPacks(): PaymentTier[] {
  return payAsYouGoPacks;
}



