/**
 * Creem.io Integration Utilities
 * 
 * Helper functions for Creem checkout URL generation and payment processing
 */

const CREEM_API_KEY = process.env.CREEM_API_KEY || '';
const CREEM_PRODUCT_ID = process.env.CREEM_PRODUCT_ID || '';
const CREEM_API_BASE = 'https://api.creem.io/v1';

// Creem mode: 'sandbox' for testing, 'production' for live
// Set CREEM_MODE=sandbox in .env.local for testing
const CREEM_MODE = process.env.CREEM_MODE || (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox');
const IS_SANDBOX = CREEM_MODE === 'sandbox';

/**
 * Generate Creem checkout URL for a user
 * Since the API returns 403, we'll use direct checkout URLs
 * Format: https://www.creem.io/checkout/{product_id}?metadata[user_id]={userId}&metadata[plan_id]={planId}&metadata[billing_cycle]={billingCycle}
 * 
 * Note: You'll need to create products in Creem for each plan (starter, standard, pro) 
 * and for each billing cycle (monthly, annual). Store their product IDs in environment variables.
 */
export async function generateCreemCheckoutUrl(
  userId: string, 
  planId: string = 'standard', 
  billingCycle: string = 'monthly'
): Promise<string> {
  // Normalize billing cycle for pay-as-you-go
  if (planId.startsWith('pack-')) {
    billingCycle = 'one-time';
  }
  // TODO: Map planId + billingCycle to actual Creem product IDs
  // For now, using the default CREEM_PRODUCT_ID
  // You should create environment variables like:
  // CREEM_PRODUCT_STARTER_MONTHLY, CREEM_PRODUCT_STARTER_ANNUAL, etc.
  const productId = CREEM_PRODUCT_ID; // This should be mapped based on planId and billingCycle
  
  if (!productId) {
    console.error('❌ CREEM_PRODUCT_ID is not set');
    throw new Error('CREEM_PRODUCT_ID is not set in environment variables');
  }

  // Use direct checkout URL format (no API call needed)
  // This works around the 403 API permission issue
  // Format: https://www.creem.io/test/payment/{product_id} for sandbox
  // Format: https://www.creem.io/payment/{product_id} for production
  const baseUrl = IS_SANDBOX 
    ? 'https://www.creem.io/test/payment'
    : 'https://www.creem.io/payment';

  // Build checkout URL with product ID and metadata as query params
  const params = new URLSearchParams({
    'metadata[user_id]': userId,
    'metadata[plan_id]': planId,
    'metadata[billing_cycle]': billingCycle,
  });
  
  const checkoutUrl = `${baseUrl}/${productId}?${params.toString()}`;

  console.log('✅ Generated direct Creem checkout URL:', {
    productId,
    userId,
    planId,
    billingCycle,
    mode: IS_SANDBOX ? 'test' : 'production',
    url: checkoutUrl.replace(userId, '***'), // Don't log full URL with user ID
  });

  return checkoutUrl;
}

/**
 * Get current Creem mode
 */
export function getCreemMode(): 'sandbox' | 'production' {
  return IS_SANDBOX ? 'sandbox' : 'production';
}

/**
 * Verify Creem webhook signature (if Creem provides webhook signing)
 * This is a placeholder - update based on Creem's webhook documentation
 */
export function verifyCreemWebhook(body: string, signature: string): boolean {
  // TODO: Implement webhook signature verification when Creem documentation is available
  // For now, we'll rely on the API key check in the webhook handler
  return true;
}
