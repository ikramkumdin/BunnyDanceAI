// Payment integration utilities
// This file contains helper functions for Stripe/Lemon integration

export interface PaymentTier {
  id: string;
  name: string;
  price: number;
  type: 'monthly' | 'lifetime' | 'pay-per-video';
  features: string[];
}

export const paymentTiers: PaymentTier[] = [
  {
    id: 'pro-monthly',
    name: 'Pro Monthly',
    price: 14.99,
    type: 'monthly',
    features: [
      'Unlimited video generation',
      '4K quality videos',
      'No watermarks',
      'Priority processing',
      'Access to all templates',
    ],
  },
  {
    id: 'lifetime',
    name: 'Lifetime VIP',
    price: 149,
    type: 'lifetime',
    features: [
      'Everything in Pro',
      'All future templates',
      'Hidden Vault access',
      'Exclusive anime templates',
      'Lifetime updates',
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



