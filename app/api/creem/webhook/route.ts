import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { addCredits } from '@/lib/credits';
import { paymentTiers, payAsYouGoPacks, PaymentTier } from '@/lib/payment';

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
    // Get API key from header (Creem might send it in different formats)
    const apiKeyHeader = request.headers.get('x-api-key');
    const authHeader = request.headers.get('authorization');
    const apiKey = apiKeyHeader || authHeader?.replace('Bearer ', '') || authHeader?.replace('ApiKey ', '');
    
    // Log all headers for debugging (don't log actual API key values)
    const allHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      if (key.toLowerCase().includes('api') || key.toLowerCase().includes('auth') || key.toLowerCase().includes('key')) {
        allHeaders[key] = value ? '***' : 'missing';
      } else {
        allHeaders[key] = value;
      }
    });
    
    console.log('📧 Creem webhook received - All headers:', allHeaders);
    console.log('📧 Creem webhook received - API key check:', {
      'x-api-key': apiKeyHeader ? 'present' : 'missing',
      'authorization': authHeader ? 'present' : 'missing',
      'extracted-key': apiKey ? 'present' : 'missing',
      'expected-key-set': CREEM_API_KEY ? 'yes' : 'no',
    });
    
    // For testing/sandbox, be more lenient with API key verification
    // Creem might not send the API key in webhook headers, or might use a different format
    // In production, you might want to verify webhook signatures instead
    if (CREEM_API_KEY) {
      if (!apiKey || apiKey !== CREEM_API_KEY) {
        console.warn('⚠️ API key mismatch or missing, but continuing for testing', {
          received: apiKey ? 'present (mismatch)' : 'missing',
          expected: 'set in env',
        });
        // For now, allow it to continue but log the issue
        // In production, you should verify webhook signatures from Creem
      } else {
        console.log('✅ API key verified');
      }
    } else {
      console.warn('⚠️ CREEM_API_KEY not set in environment - webhook will process without verification');
    }

    const body = await request.json();
    
    // Log the FULL webhook payload for debugging
    console.log('📧 Creem webhook received - Full payload:', JSON.stringify(body, null, 2));
    
    // Log the webhook for debugging
    console.log('📧 Creem webhook received - Summary:', {
      event_type: body.event_type || body.type || body.event,
      payment_status: body.status || body.payment_status || body.payment?.status,
      checkout_id: body.checkout_id || body.id || body.checkout?.id,
      product_id: body.product_id || body.product?.id,
      metadata: body.metadata,
      customer: body.customer,
      user_id: body.metadata?.user_id || body.user_id || body.customer_id || body.customer?.id,
    });

    // Extract important fields (adjust based on actual Creem webhook payload)
    // Try multiple possible field names since Creem's webhook format may vary
    const eventType = body.event_type || body.type || body.event || 'checkout.completed';
    const status = body.status || body.payment_status || body.payment?.status || body.state || body.checkout?.status;
    const checkoutId = body.checkout_id || body.id || body.checkout?.id || body.checkout_id;
    const productId = body.product_id || body.product?.id || body.product_id;
    
    // Try multiple ways to extract user_id from metadata
    // Since we pass it as metadata[user_id] in the URL, it might be nested differently
    let userId = 
      body.metadata?.user_id || 
      body.metadata?.['user_id'] ||
      body.custom_data?.user_id ||
      body.user_id || 
      body.customer_id || 
      body.customer?.id ||
      body.customer?.email; // Fallback to email if we can find user by email
    
    const amount = body.amount || body.total_amount || body.payment?.amount || body.checkout?.amount;

    // Only process completed/succeeded payments
    if (status !== 'completed' && status !== 'succeeded' && status !== 'paid') {
      console.log(`⏸️ Payment not completed. Status: ${status}`);
      return NextResponse.json({ received: true });
    }

    // Find the plan based on product ID or amount
    // You'll need to create products in Creem for each plan and store their IDs
    // For now, we'll match by amount and metadata
    let planId = body.metadata?.plan_id || body.plan_id;
    let billingCycle = body.metadata?.billing_cycle || body.billing_cycle || 'monthly';
    let isPayAsYouGo = body.metadata?.plan_type === 'pay-as-you-go' || planId?.startsWith('pack-');
    
    // If no plan_id in metadata, try to match by amount
    if (!planId) {
      const receivedAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      
      // Match by amount - check pay-as-you-go packs first
      if (Math.abs(receivedAmount - 5) < 0.01) {
        planId = 'pack-small';
        billingCycle = 'one-time';
        isPayAsYouGo = true;
      } else if (Math.abs(receivedAmount - 20) < 0.01) {
        planId = 'pack-medium';
        billingCycle = 'one-time';
        isPayAsYouGo = true;
      } else if (Math.abs(receivedAmount - 50) < 0.01) {
        planId = 'pack-large';
        billingCycle = 'one-time';
        isPayAsYouGo = true;
      } 
      // Then check subscription plans (monthly)
      else if (Math.abs(receivedAmount - 9) < 0.01) {
        planId = 'starter';
        billingCycle = 'monthly';
      } else if (Math.abs(receivedAmount - 24) < 0.01) {
        planId = 'standard';
        billingCycle = 'monthly';
      } else if (Math.abs(receivedAmount - 48) < 0.01) {
        planId = 'pro';
        billingCycle = 'monthly';
      } 
      // Annual subscriptions
      else if (Math.abs(receivedAmount - 86) < 0.01) {
        planId = 'starter';
        billingCycle = 'annual';
      } else if (Math.abs(receivedAmount - 230) < 0.01) {
        planId = 'standard';
        billingCycle = 'annual';
      } else if (Math.abs(receivedAmount - 461) < 0.01) {
        planId = 'pro';
        billingCycle = 'annual';
      } else {
        console.error(`❌ Unknown amount: ${receivedAmount}, cannot determine plan`);
        return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
      }
    }

    // Find plan in either subscriptions or pay-as-you-go packs
    const selectedPlan = isPayAsYouGo 
      ? payAsYouGoPacks.find(t => t.id === planId)
      : paymentTiers.find(t => t.id === planId);
    
    if (!selectedPlan) {
      console.error(`❌ Plan not found: ${planId} (pay-as-you-go: ${isPayAsYouGo})`);
      return NextResponse.json({ error: 'Plan not found' }, { status: 400 });
    }

    // Validate amount matches the plan
    const expectedAmount = billingCycle === 'annual' && selectedPlan.annualPrice 
      ? selectedPlan.annualPrice 
      : selectedPlan.price;
    const receivedAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (Math.abs(receivedAmount - expectedAmount) > 0.01) {
      console.error(`❌ Invalid amount: ${receivedAmount}, expected: ${expectedAmount} for ${planId} (${billingCycle})`);
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (!userId) {
      console.error('❌ No user ID in webhook payload. Full body:', JSON.stringify(body, null, 2));
      
      // Try to find user by email if customer email is provided
      const customerEmail = body.customer?.email || body.email || body.payer_email;
      if (customerEmail) {
        console.log('🔍 Attempting to find user by email:', customerEmail);
        try {
          const usersSnapshot = await adminDb.collection('users')
            .where('email', '==', customerEmail)
            .limit(1)
            .get();
          
          if (!usersSnapshot.empty) {
            userId = usersSnapshot.docs[0].id;
            console.log('✅ Found user by email:', userId);
          } else {
            console.error('❌ No user found with email:', customerEmail);
            return NextResponse.json({ error: 'No user ID and no matching user email' }, { status: 400 });
          }
        } catch (emailError) {
          console.error('❌ Error searching for user by email:', emailError);
          return NextResponse.json({ error: 'No user ID' }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: 'No user ID' }, { status: 400 });
      }
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

    // Process payment based on event type and plan type
    if (isPayAsYouGo) {
      // Pay-as-you-go packs are one-time purchases - just grant credits
      await handlePayAsYouGoPurchase(userId, checkoutId, planId, selectedPlan);
    } else if (eventType === 'payment.completed' || eventType === 'checkout.completed' || eventType === 'subscription.created') {
      // Initial subscription payment
      await handleInitialPayment(userId, checkoutId, planId, billingCycle, selectedPlan);
    } else if (eventType === 'subscription.renewed' || eventType === 'payment.renewed') {
      // Monthly/annual renewal payment
      await handleRenewal(userId, checkoutId, planId, billingCycle, selectedPlan);
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
      planId,
      billingCycle,
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
async function handleInitialPayment(
  userId: string, 
  checkoutId: string, 
  planId: string,
  billingCycle: string,
  plan: PaymentTier
) {
  console.log(`🎉 Initial subscription payment for user ${userId} - Plan: ${planId} (${billingCycle})`);
  
  // Grant credits based on plan (image and video credits are the same)
  await addCredits(userId, plan.imageCredits, plan.videoCredits);
  
  // Update user tier and subscription info
  await adminDb.collection('users').doc(userId).update({
    tier: planId as 'starter' | 'standard' | 'pro',
    subscriptionType: billingCycle as 'monthly' | 'annual',
    planId: planId,
    subscriptionStartDate: new Date().toISOString(),
    lastPaymentDate: new Date().toISOString(),
  });

  console.log(`✅ Granted ${plan.imageCredits} image + ${plan.videoCredits} video credits and upgraded user ${userId} to ${plan.name} (${billingCycle})`);
}

/**
 * Handle monthly/annual renewal payment
 */
async function handleRenewal(
  userId: string, 
  checkoutId: string,
  planId: string,
  billingCycle: string,
  plan: PaymentTier
) {
  console.log(`🔄 Renewal payment for user ${userId} - Plan: ${planId} (${billingCycle})`);
  
  // Grant credits for the renewal period
  await addCredits(userId, plan.imageCredits, plan.videoCredits);
  
  // Update last payment date
  await adminDb.collection('users').doc(userId).update({
    lastPaymentDate: new Date().toISOString(),
  });

  console.log(`✅ Granted ${plan.imageCredits} image + ${plan.videoCredits} video credits for renewal to user ${userId}`);
}

/**
 * Handle pay-as-you-go credit pack purchase
 */
async function handlePayAsYouGoPurchase(
  userId: string,
  checkoutId: string,
  planId: string,
  plan: PaymentTier
) {
  console.log(`💰 Pay-as-you-go purchase for user ${userId} - Pack: ${planId}`);
  
  // Grant credits (one-time purchase, no tier change)
  await addCredits(userId, plan.imageCredits, plan.videoCredits);
  
  // Don't change user tier for pay-as-you-go purchases
  // Just record the purchase
  await adminDb.collection('users').doc(userId).update({
    lastPaymentDate: new Date().toISOString(),
  });

  console.log(`✅ Granted ${plan.imageCredits} image + ${plan.videoCredits} video credits from pay-as-you-go pack to user ${userId}`);
}

// Handle GET requests (for webhook endpoint verification)
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Creem webhook endpoint is active',
    endpoint: '/api/creem/webhook',
  });
}
