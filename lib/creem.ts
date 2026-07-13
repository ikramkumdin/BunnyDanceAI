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
const CREEM_PRODUCT_ID = process.env.CREEM_PRODUCT_ID || ''; // Fallback default

// Per-plan Creem product IDs (set in .env.local / Vercel)
// Subscriptions: monthly and annual are separate products in Creem
const PLAN_PRODUCT_MAP: Record<string, string | undefined> = {
  // Monthly subscriptions
  'starter_monthly':    process.env.CREEM_PRODUCT_STARTER_MONTHLY,
  'standard_monthly':   process.env.CREEM_PRODUCT_STANDARD_MONTHLY,
  'pro_monthly':        process.env.CREEM_PRODUCT_PRO_MONTHLY,
  // Annual subscriptions
  'starter_annual':     process.env.CREEM_PRODUCT_STARTER_ANNUAL,
  'standard_annual':    process.env.CREEM_PRODUCT_STANDARD_ANNUAL,
  'pro_annual':         process.env.CREEM_PRODUCT_PRO_ANNUAL,
  // Pay-as-you-go packs
  'pack-taste':         process.env.CREEM_PRODUCT_PACK_TASTE,
  'pack-casual':        process.env.CREEM_PRODUCT_PACK_CASUAL,
  'pack-regular':       process.env.CREEM_PRODUCT_PACK_REGULAR,
  'pack-power':         process.env.CREEM_PRODUCT_PACK_POWER,
};

function getProductId(planId: string, billingCycle: string): string {
  // For subscriptions, key is planId_billingCycle (e.g. "starter_monthly")
  // For PAYG, key is just the planId (e.g. "pack-taste")
  const key = planId.startsWith('pack-') ? planId : `${planId}_${billingCycle}`;
  const productId = PLAN_PRODUCT_MAP[key];
  if (productId) return productId;
  // Fallback to the single CREEM_PRODUCT_ID env var
  console.warn(`⚠️ No Creem product ID for plan "${key}", falling back to CREEM_PRODUCT_ID`);
  return CREEM_PRODUCT_ID;
}

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

  const productId = getProductId(planId, billingCycle);
  if (!productId) {
    throw new Error(`No Creem product ID configured for plan "${planId}" (${billingCycle}). Set the appropriate CREEM_PRODUCT_* env var.`);
  }
  if (!CREEM_API_KEY) {
    throw new Error('CREEM_API_KEY is not set in environment variables');
  }

  const baseUrl = successUrlBase || process.env.NEXT_PUBLIC_BASE_URL || 'https://www.waifudance.com';

  const body = {
    product_id: productId,
    // {CHECKOUT_ID} is a Creem template variable replaced with the real checkout id on redirect.
    // The success page uses it to trigger the manual-grant fallback when the webhook fails.
    success_url: `${baseUrl}/payment/success?plan_id=${planId}&billing_cycle=${billingCycle}&checkout_id={CHECKOUT_ID}`,
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
