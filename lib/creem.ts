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
 * This creates a checkout session and returns the URL to redirect to
 */
export async function generateCreemCheckoutUrl(userId: string): Promise<string> {
  if (!CREEM_API_KEY) {
    throw new Error('CREEM_API_KEY is not set in environment variables');
  }

  if (!CREEM_PRODUCT_ID) {
    throw new Error('CREEM_PRODUCT_ID is not set in environment variables');
  }

  try {
    const response = await fetch(`${CREEM_API_BASE}/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CREEM_API_KEY,
      },
      body: JSON.stringify({
        product_id: CREEM_PRODUCT_ID,
        // Pass user ID as metadata for webhook processing
        metadata: {
          user_id: userId,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Creem API error:', errorText);
      throw new Error(`Failed to create checkout: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.checkout_url) {
      throw new Error('No checkout_url in Creem response');
    }

    return data.checkout_url;
  } catch (error) {
    console.error('Error generating Creem checkout URL:', error);
    throw error;
  }
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
