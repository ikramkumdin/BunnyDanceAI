// Payment integration utilities
// This file contains helper functions for Stripe/Lemon integration

export interface PaymentTier {
  id: string;
  name: string;
  price: number;
  type: 'weekly' | 'monthly' | 'lifetime' | 'pay-per-video';
  credits?: number; // Optional: for credit-based tiers like weekly
  features: string[];
}

export const paymentTiers: PaymentTier[] = [
  {
    id: 'pro-weekly',
    name: 'Pro Weekly',
    price: 5.99,
    type: 'weekly',
    credits: 300,
    features: [
      '300 Credits per week',
      'Billed weekly',
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



