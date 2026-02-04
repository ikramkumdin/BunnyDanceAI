// Payment integration utilities
// This file contains helper functions for Stripe/Lemon integration

export interface PaymentTier {
  id: string;
  name: string;
  price: number;
  annualPrice?: number; // Annual price with 20% discount
  type: 'monthly' | 'annual';
  credits: number; // Total credits (same for images and videos)
  imageCredits: number; // Image credits per month
  videoCredits: number; // Video credits per month
  videosPerMonth: number;
  perVideoCost: number;
  annualPerVideoCost?: number;
  features: string[];
  popular?: boolean; // Mark popular plan
}

export const paymentTiers: PaymentTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 9,
    annualPrice: 86,
    type: 'monthly',
    credits: 200,
    imageCredits: 200, // Same as video credits
    videoCredits: 200,
    videosPerMonth: 10,
    perVideoCost: 0.90,
    annualPerVideoCost: 0.86,
    features: [
      '200 Image Credits per month',
      '200 Video Credits per month',
      '~10 videos per month',
      '4K quality videos',
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
    imageCredits: 800, // Same as video credits
    videoCredits: 800,
    videosPerMonth: 40,
    perVideoCost: 0.60,
    annualPerVideoCost: 0.58,
    features: [
      '800 Image Credits per month',
      '800 Video Credits per month',
      '~40 videos per month',
      '4K quality videos',
      'All dance effects',
      'All templates included',
      'Priority processing',
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
    imageCredits: 2500, // Same as video credits
    videoCredits: 2500,
    videosPerMonth: 125,
    perVideoCost: 0.38,
    annualPerVideoCost: 0.37,
    features: [
      '2,500 Image Credits per month',
      '2,500 Video Credits per month',
      '~125 videos per month',
      '4K quality videos',
      'All dance effects',
      'All templates included',
      'Priority processing',
      'Cancel anytime',
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



