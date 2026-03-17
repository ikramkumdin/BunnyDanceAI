/**
 * Creem.io Integration Utilities
 *
 * Docs: https://docs.creem.io/api-reference/introduction
 *
 * Test mode  → base URL: https://test-api.creem.io/v1
 * Production → base URL: https://api.creem.io/v1
 */

import * as crypto from 'crypto';

const CREEM_API_KEY = process.env.CREEM_API_KEY || '';
const CREEM_PRODUCT_ID = process.env.CREEM_PRODUCT_ID || '';

const CREEM_MODE = process.env.CREEM_MODE || (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox');
const IS_SANDBOX = CREEM_MODE === 'sandbox';

// Correct base URLs per Creem docs
const CREEM_API_BASE = IS_SANDBOX
  ? 'https://test-api.creem.io/v1'
  : 'https://api.creem.io/v1';

/**
 * Create a Creem checkout session via the API and return the checkout URL.
 *
 * POST {base}/checkouts
 * Headers: x-api-key, Content-Type: application/json
 * Body: { product_id, success_url, metadata }
 * Response: { checkout_url, id, ... }
 */
export async function generateCreemCheckoutUrl(
  userId: string,
  planId: string = 'standard',
  billingCycle: string = 'monthly',
  successUrlBase?: string
): Promise<string> {
  if (planId.startsWith('pack-')) {
    billingCycle = 'one-time';
  }

  const productId = CREEM_PRODUCT_ID;
  if (!productId) {
    throw new Error('CREEM_PRODUCT_ID is not set in environment variables');
  }
  if (!CREEM_API_KEY) {
    throw new Error('CREEM_API_KEY is not set in environment variables');
  }

  const baseUrl = successUrlBase || process.env.NEXT_PUBLIC_BASE_URL || 'https://www.waifudance.com';

  const body = {
    product_id: productId,
    success_url: `${baseUrl}/payment/success`,
    metadata: {
      user_id: userId,
      plan_id: planId,
      billing_cycle: billingCycle,
    },
  };

  console.log('🔄 Creating Creem checkout session:', {
    apiBase: CREEM_API_BASE,
    productId,
    planId,
    billingCycle,
    mode: IS_SANDBOX ? 'test' : 'production',
  });

  const response = await fetch(`${CREEM_API_BASE}/checkouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CREEM_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Creem API error (${response.status}):`, errorText);
    throw new Error(`Creem API returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (!data.checkout_url) {
    console.error('❌ Creem API response missing checkout_url:', data);
    throw new Error('Creem API did not return a checkout_url');
  }

  console.log('✅ Creem checkout session created:', {
    checkoutId: data.id,
    mode: data.mode,
  });

  return data.checkout_url;
}

/**
 * Get current Creem mode
 */
export function getCreemMode(): 'sandbox' | 'production' {
  return IS_SANDBOX ? 'sandbox' : 'production';
}

/**
 * Verify Creem webhook signature using HMAC SHA-256.
 *
 * Creem sends the signature in the `creem-signature` header.
 * The secret is your webhook signing secret from Creem Dashboard → Developers → Webhook.
 */
export function verifyCreemWebhook(payload: string, signature: string): boolean {
  const secret = process.env.CREEM_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('⚠️ CREEM_WEBHOOK_SECRET not set — skipping signature verification');
    return true; // Allow in dev / sandbox when secret is not configured
  }
  const computed = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return computed === signature;
}
