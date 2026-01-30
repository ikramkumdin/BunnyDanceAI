/**
 * PayPal Integration Utilities
 * 
 * Helper functions for PayPal PDT (Payment Data Transfer) verification
 * and payment processing
 */

const PAYPAL_EMAIL = '277360770@qq.com';
const PAYPAL_PDT_TOKEN = process.env.PAYPAL_PDT_TOKEN || '';

// PayPal mode: 'sandbox' for testing, 'production' for live
// Set PAYPAL_MODE=sandbox in .env.local for testing
const PAYPAL_MODE = process.env.PAYPAL_MODE || (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox');
const IS_SANDBOX = PAYPAL_MODE === 'sandbox';

/**
 * Verify Payment Data Transfer (PDT) token with PayPal
 * This is used on the success page to verify the transaction
 */
export async function verifyPDT(tx: string): Promise<{
  verified: boolean;
  data?: Record<string, string>;
}> {
  if (!PAYPAL_PDT_TOKEN) {
    console.warn('⚠️ PAYPAL_PDT_TOKEN not set in environment variables');
    return { verified: false };
  }

  try {
    const verifyUrl = IS_SANDBOX
      ? 'https://www.sandbox.paypal.com/cgi-bin/webscr'
      : 'https://www.paypal.com/cgi-bin/webscr';

    const params = new URLSearchParams({
      cmd: '_notify-synch',
      txn: tx,
      at: PAYPAL_PDT_TOKEN,
    });

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const responseText = await response.text();
    
    if (responseText.startsWith('SUCCESS')) {
      // Parse the response
      const lines = responseText.split('\n');
      const data: Record<string, string> = {};
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          data[key] = decodeURIComponent(valueParts.join('='));
        }
      }
      
      return { verified: true, data };
    } else {
      return { verified: false };
    }
  } catch (error) {
    console.error('Error verifying PDT:', error);
    return { verified: false };
  }
}

/**
 * Get PayPal email for button generation
 */
export function getPayPalEmail(): string {
  return PAYPAL_EMAIL;
}

/**
 * Generate PayPal subscription button URL
 * Supports both sandbox and production modes
 */
export function generatePayPalButtonUrl(userId: string, useSandbox?: boolean): string {
  const sandbox = useSandbox !== undefined ? useSandbox : IS_SANDBOX;
  const baseUrl = sandbox 
    ? 'https://www.sandbox.paypal.com/cgi-bin/webscr'
    : 'https://www.paypal.com/cgi-bin/webscr';
  
  // Use sandbox email if in sandbox mode, otherwise use production email
  const businessEmail = sandbox 
    ? (process.env.PAYPAL_SANDBOX_EMAIL || PAYPAL_EMAIL)
    : PAYPAL_EMAIL;

  const params = new URLSearchParams({
    cmd: '_xclick-subscriptions',
    business: businessEmail,
    item_name: 'WaifuDance Pro Weekly - 300 Credits',
    item_number: 'pro-weekly',
    a3: '5.99',
    p3: '1',
    t3: 'W',
    src: '1',
    currency_code: 'USD',
    return: 'https://www.waifudance.com/payment/success',
    cancel_return: 'https://www.waifudance.com/payment/canceled',
    custom: userId,
    notify_url: 'https://www.waifudance.com/api/paypal/ipn',
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Get current PayPal mode
 */
export function getPayPalMode(): 'sandbox' | 'production' {
  return IS_SANDBOX ? 'sandbox' : 'production';
}

/**
 * Generate PayPal button HTML form
 * Use this in your PaymentModal component
 */
export function generatePayPalButtonHtml(userId: string, useSandbox?: boolean): string {
  const sandbox = useSandbox !== undefined ? useSandbox : IS_SANDBOX;
  const baseUrl = sandbox 
    ? 'https://www.sandbox.paypal.com/cgi-bin/webscr'
    : 'https://www.paypal.com/cgi-bin/webscr';
  
  const businessEmail = sandbox 
    ? (process.env.PAYPAL_SANDBOX_EMAIL || PAYPAL_EMAIL)
    : PAYPAL_EMAIL;

  return `
    <form action="${baseUrl}" method="post" target="_top">
      <input type="hidden" name="cmd" value="_xclick-subscriptions">
      <input type="hidden" name="business" value="${businessEmail}">
      <input type="hidden" name="item_name" value="WaifuDance Pro Weekly - 300 Credits">
      <input type="hidden" name="item_number" value="pro-weekly">
      <input type="hidden" name="a3" value="5.99">
      <input type="hidden" name="p3" value="1">
      <input type="hidden" name="t3" value="W">
      <input type="hidden" name="src" value="1">
      <input type="hidden" name="currency_code" value="USD">
      <input type="hidden" name="return" value="https://www.waifudance.com/payment/success">
      <input type="hidden" name="cancel_return" value="https://www.waifudance.com/payment/canceled">
      <input type="hidden" name="custom" value="${userId}">
      <input type="hidden" name="notify_url" value="https://www.waifudance.com/api/paypal/ipn">
      <input type="submit" value="Subscribe $5.99/week" class="paypal-button">
    </form>
  `;
}
