import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { addCredits } from '@/lib/credits';

/**
 * PayPal IPN (Instant Payment Notification) Handler
 * 
 * This endpoint receives payment notifications from PayPal and automatically:
 * 1. Verifies the payment is legitimate
 * 2. Grants 300 credits for weekly subscription
 * 3. Handles subscription renewals
 * 
 * PayPal will POST to this endpoint: https://www.waifudance.com/api/paypal/ipn
 */

// PayPal verification endpoint (use sandbox for testing)
// Set PAYPAL_MODE=sandbox in .env.local for testing, or PAYPAL_MODE=production for live
const PAYPAL_MODE = process.env.PAYPAL_MODE || (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox');
const PAYPAL_VERIFY_URL = PAYPAL_MODE === 'production'
  ? 'https://ipnpb.paypal.com/cgi-bin/webscr'
  : 'https://ipnpb.sandbox.paypal.com/cgi-bin/webscr';

export async function POST(request: NextRequest) {
  try {
    // Get the raw body for PayPal verification
    const body = await request.text();
    
    // Parse the form data
    const params = new URLSearchParams(body);
    const formData: Record<string, string> = {};
    params.forEach((value, key) => {
      formData[key] = value;
    });

    // Log the IPN for debugging
    const paypalMode = process.env.PAYPAL_MODE || (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox');
    console.log(`📧 PayPal IPN received (${paypalMode}):`, {
      txn_type: formData.txn_type,
      payment_status: formData.payment_status,
      item_number: formData.item_number,
      custom: formData.custom, // User ID
      txn_id: formData.txn_id || formData.subscr_id,
      test_ipn: formData.test_ipn, // Will be '1' for sandbox
    });

    // Verify the IPN with PayPal
    const verified = await verifyIPN(body);
    if (!verified) {
      console.error('❌ IPN verification failed');
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
    }

    // Extract important fields
    const txnType = formData.txn_type;
    const paymentStatus = formData.payment_status;
    const itemNumber = formData.item_number;
    const userId = formData.custom; // User ID passed in custom field
    const txnId = formData.txn_id || formData.subscr_id;
    const amount = formData.mc_gross || formData.amount3;
    const payerEmail = formData.payer_email;

    // Only process completed payments
    if (paymentStatus !== 'Completed') {
      console.log(`⏸️ Payment not completed. Status: ${paymentStatus}`);
      return NextResponse.json({ received: true });
    }

    // Check if this is for our weekly subscription
    if (itemNumber !== 'pro-weekly') {
      console.log(`⚠️ Unknown item: ${itemNumber}`);
      return NextResponse.json({ received: true });
    }

    // Validate amount (should be $5.99)
    const expectedAmount = '5.99';
    if (amount !== expectedAmount) {
      console.error(`❌ Invalid amount: ${amount}, expected: ${expectedAmount}`);
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (!userId) {
      console.error('❌ No user ID in custom field');
      return NextResponse.json({ error: 'No user ID' }, { status: 400 });
    }

    // Check if we've already processed this transaction (prevent duplicates)
    const transactionRef = adminDb.collection('paypal_transactions').doc(txnId);
    const existingTxn = await transactionRef.get();
    
    if (existingTxn.exists) {
      console.log(`✅ Transaction ${txnId} already processed`);
      return NextResponse.json({ received: true });
    }

    // Process different transaction types
    if (txnType === 'subscr_signup' || txnType === 'web_accept') {
      // Initial subscription signup or one-time payment
      await handleInitialPayment(userId, txnId, payerEmail);
    } else if (txnType === 'subscr_payment') {
      // Weekly renewal payment
      await handleRenewal(userId, txnId, payerEmail);
    } else {
      console.log(`ℹ️ Unhandled transaction type: ${txnType}`);
      return NextResponse.json({ received: true });
    }

    // Mark transaction as processed
    await transactionRef.set({
      userId,
      txnId,
      txnType,
      amount,
      paymentStatus,
      processedAt: new Date().toISOString(),
      payerEmail,
    });

    console.log(`✅ Successfully processed payment for user ${userId}`);
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('❌ IPN processing error:', error);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Verify IPN message with PayPal
 */
async function verifyIPN(body: string): Promise<boolean> {
  try {
    // PayPal requires we send back the original message with 'cmd=_notify-validate'
    const verifyBody = `cmd=_notify-validate&${body}`;
    
    const response = await fetch(PAYPAL_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'WaifuDance-IPN/1.0',
      },
      body: verifyBody,
    });

    const verificationResult = await response.text();
    
    // PayPal returns "VERIFIED" or "INVALID"
    return verificationResult === 'VERIFIED';
  } catch (error) {
    console.error('Error verifying IPN:', error);
    return false;
  }
}

/**
 * Handle initial subscription payment
 */
async function handleInitialPayment(userId: string, txnId: string, payerEmail?: string) {
  console.log(`🎉 Initial subscription payment for user ${userId}`);
  
  // Grant 300 credits (150 image + 150 video, or split as needed)
  // For weekly plan, we grant 300 total credits
  await addCredits(userId, 150, 150);
  
  // Update user tier to 'pro' for weekly subscribers
  await adminDb.collection('users').doc(userId).update({
    tier: 'pro',
    subscriptionType: 'weekly',
    subscriptionStartDate: new Date().toISOString(),
    lastPaymentDate: new Date().toISOString(),
    ...(payerEmail && { paypalEmail: payerEmail }),
  });

  console.log(`✅ Granted 300 credits and upgraded user ${userId} to Pro Weekly`);
}

/**
 * Handle weekly renewal payment
 */
async function handleRenewal(userId: string, txnId: string, payerEmail?: string) {
  console.log(`🔄 Weekly renewal payment for user ${userId}`);
  
  // Grant 300 credits for the new week
  await addCredits(userId, 150, 150);
  
  // Update last payment date
  await adminDb.collection('users').doc(userId).update({
    lastPaymentDate: new Date().toISOString(),
    ...(payerEmail && { paypalEmail: payerEmail }),
  });

  console.log(`✅ Granted 300 credits for weekly renewal to user ${userId}`);
}

// Handle GET requests (PayPal sometimes sends GET for verification)
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'PayPal IPN endpoint is active',
    endpoint: '/api/paypal/ipn',
  });
}
