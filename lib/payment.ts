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
  videoResolution?: 'HD' | '4K' | '8K';
  generationSpeed?: 'Standard' | 'Priority' | 'Ultra Fast';
  watermarkRemoval?: boolean;
  exclusiveModels?: boolean;
}

// Subscription plans
export const paymentTiers: PaymentTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 9,
    annualPrice: 86,
    type: 'monthly',
    credits: 200,
    imageCredits: 200,
    videoCredits: 200, // 200 credits = 10 videos (200 / 20)
    videosPerMonth: 10, // 200 credits / 20 credits per video
    perVideoCost: 0.90,
    annualPerVideoCost: 0.86,
    videoResolution: '4K',
    generationSpeed: 'Standard',
    watermarkRemoval: false,
    exclusiveModels: false,
    features: [
      '200 Image Credits per month',
      '200 Video Credits per month (10 videos)',
      '4K quality videos',
      'Standard generation speed',
      'All dance effects',
      'All templates included',
      'Cancel anytime',
    ],
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 24,
    annualPrice: 230,
    type: 'monthly',
    credits: 800,
    imageCredits: 800,
    videoCredits: 800, // 800 credits = 40 videos (800 / 20)
    videosPerMonth: 40, // 800 credits / 20 credits per video
    perVideoCost: 0.60,
    annualPerVideoCost: 0.58,
    videoResolution: '4K',
    generationSpeed: 'Priority',
    watermarkRemoval: true,
    exclusiveModels: false,
    features: [
      '800 Image Credits per month',
      '800 Video Credits per month (40 videos)',
      '4K quality videos',
      'Priority processing speed',
      'Watermark removal',
      'All dance effects',
      'All templates included',
      'Cancel anytime',
    ],
    popular: true, // Mark as popular
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 48,
    annualPrice: 461,
    type: 'monthly',
    credits: 2500,
    imageCredits: 2500,
    videoCredits: 2500, // 2500 credits = 125 videos (2500 / 20)
    videosPerMonth: 125, // 2500 credits / 20 credits per video
    perVideoCost: 0.38,
    annualPerVideoCost: 0.37,
    videoResolution: '8K',
    generationSpeed: 'Ultra Fast',
    watermarkRemoval: true,
    exclusiveModels: true,
    features: [
      '2,500 Image Credits per month',
      '2,500 Video Credits per month (125 videos)',
      '8K quality videos',
      'Ultra-fast generation speed',
      'Watermark removal',
      'Exclusive AI models',
      'All dance effects',
      'All templates included',
      'Cancel anytime',
    ],
  },
];

// Pay-As-You-Go Credit Packs (one-time purchases)
// Pricing strategy: $50 for 10,000 credits → $0.005/credit, 20 credits/video → $0.10/video cost
export const payAsYouGoPacks: PaymentTier[] = [
  {
    id: 'pack-basic',
    name: 'Basic',
    price: 4,
    type: 'pay-as-you-go',
    credits: 80,
    imageCredits: 80,
    videoCredits: 80, // 80 credits = 4 videos (80 / 20)
    videosPerMonth: 4,
    perVideoCost: 1.00,
    videoResolution: '4K',
    generationSpeed: 'Standard',
    watermarkRemoval: false,
    exclusiveModels: false,
    features: [
      '80 Credits',
      'Up to 4 videos',
      '4K quality videos',
      'No expiration',
      'One-time purchase',
    ],
  },
  {
    id: 'pack-plus',
    name: 'Plus',
    price: 16,
    type: 'pay-as-you-go',
    credits: 400,
    imageCredits: 400,
    videoCredits: 400, // 400 credits = 20 videos (400 / 20)
    videosPerMonth: 20,
    perVideoCost: 0.80,
    videoResolution: '4K',
    generationSpeed: 'Standard',
    watermarkRemoval: true,
    exclusiveModels: false,
    features: [
      '400 Credits',
      'Up to 20 videos',
      '4K quality videos',
      'Watermark removal',
      'No expiration',
      'One-time purchase',
      'Best value',
    ],
    popular: true,
  },
  {
    id: 'pack-premium',
    name: 'Premium',
    price: 40,
    type: 'pay-as-you-go',
    credits: 1200,
    imageCredits: 1200,
    videoCredits: 1200, // 1200 credits = 60 videos (1200 / 20)
    videosPerMonth: 60,
    perVideoCost: 0.67,
    videoResolution: '4K',
    generationSpeed: 'Priority',
    watermarkRemoval: true,
    exclusiveModels: false,
    features: [
      '1,200 Credits',
      'Up to 60 videos',
      '4K quality videos',
      'Priority processing',
      'Watermark removal',
      'No expiration',
      'One-time purchase',
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



