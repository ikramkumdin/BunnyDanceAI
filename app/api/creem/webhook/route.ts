import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { addCredits } from '@/lib/credits';

/**
 * Creem Webhook Handler
 * 
 * This endpoint receives payment notifications from Creem and automatically:
 * 1. Verifies the payment is legitimate
 * 2. Grants 300 credits for weekly subscription
 * 3. Handles subscription renewals
 * 
 * Configure this URL in Creem dashboard: https://www.waifudance.com/api/creem/webhook
 */

const CREEM_API_KEY = process.env.CREEM_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    // Verify API key from header (Creem should send this)
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (apiKey !== CREEM_API_KEY) {
      console.error('❌ Invalid API key in webhook request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Log the webhook for debugging
    console.log('📧 Creem webhook received:', {
      event_type: body.event_type || body.type,
      payment_status: body.status || body.payment_status,
      checkout_id: body.checkout_id || body.id,
      product_id: body.product_id,
      user_id: body.metadata?.user_id || body.user_id,
    });

    // Extract important fields (adjust based on actual Creem webhook payload)
    const eventType = body.event_type || body.type || 'payment.completed';
    const status = body.status || body.payment_status || body.state;
    const checkoutId = body.checkout_id || body.id;
    const productId = body.product_id;
    const userId = body.metadata?.user_id || body.user_id || body.customer_id;
    const amount = body.amount || body.total_amount;

    // Only process completed/succeeded payments
    if (status !== 'completed' && status !== 'succeeded' && status !== 'paid') {
      console.log(`⏸️ Payment not completed. Status: ${status}`);
      return NextResponse.json({ received: true });
    }

    // Check if this is for our weekly subscription product
    const expectedProductId = process.env.CREEM_PRODUCT_ID;
    if (productId !== expectedProductId) {
      console.log(`⚠️ Unknown product: ${productId}`);
      return NextResponse.json({ received: true });
    }

    // Validate amount (should be $5.99)
    const expectedAmount = 5.99;
    const receivedAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (Math.abs(receivedAmount - expectedAmount) > 0.01) {
      console.error(`❌ Invalid amount: ${receivedAmount}, expected: ${expectedAmount}`);
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (!userId) {
      console.error('❌ No user ID in webhook payload');
      return NextResponse.json({ error: 'No user ID' }, { status: 400 });
    }

    if (!checkoutId) {
      console.error('❌ No checkout ID in webhook payload');
      return NextResponse.json({ error: 'No checkout ID' }, { status: 400 });
    }

    // Check if we've already processed this transaction (prevent duplicates)
    const transactionRef = adminDb.collection('creem_transactions').doc(checkoutId);
    const existingTxn = await transactionRef.get();
    
    if (existingTxn.exists) {
      console.log(`✅ Transaction ${checkoutId} already processed`);
      return NextResponse.json({ received: true });
    }

    // Process payment based on event type
    if (eventType === 'payment.completed' || eventType === 'checkout.completed' || eventType === 'subscription.created') {
      // Initial subscription payment
      await handleInitialPayment(userId, checkoutId);
    } else if (eventType === 'subscription.renewed' || eventType === 'payment.renewed') {
      // Weekly renewal payment
      await handleRenewal(userId, checkoutId);
    } else {
      console.log(`ℹ️ Unhandled event type: ${eventType}`);
      return NextResponse.json({ received: true });
    }

    // Mark transaction as processed
    await transactionRef.set({
      userId,
      checkoutId,
      eventType,
      status,
      amount: receivedAmount,
      productId,
      processedAt: new Date().toISOString(),
    });

    console.log(`✅ Successfully processed payment for user ${userId}`);
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('❌ Creem webhook processing error:', error);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle initial subscription payment
 */
async function handleInitialPayment(userId: string, checkoutId: string) {
  console.log(`🎉 Initial subscription payment for user ${userId}`);
  
  // Grant 300 credits (150 image + 150 video)
  await addCredits(userId, 150, 150);
  
  // Update user tier to 'pro' for weekly subscribers
  await adminDb.collection('users').doc(userId).update({
    tier: 'pro',
    subscriptionType: 'weekly',
    subscriptionStartDate: new Date().toISOString(),
    lastPaymentDate: new Date().toISOString(),
  });

  console.log(`✅ Granted 300 credits and upgraded user ${userId} to Pro Weekly`);
}

/**
 * Handle weekly renewal payment
 */
async function handleRenewal(userId: string, checkoutId: string) {
  console.log(`🔄 Weekly renewal payment for user ${userId}`);
  
  // Grant 300 credits for the new week
  await addCredits(userId, 150, 150);
  
  // Update last payment date
  await adminDb.collection('users').doc(userId).update({
    lastPaymentDate: new Date().toISOString(),
  });

  console.log(`✅ Granted 300 credits for weekly renewal to user ${userId}`);
}

// Handle GET requests (for webhook endpoint verification)
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Creem webhook endpoint is active',
    endpoint: '/api/creem/webhook',
  });
}
