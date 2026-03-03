import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { addCredits } from '@/lib/credits';
import { paymentTiers, payAsYouGoPacks, PaymentTier } from '@/lib/payment';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10' as any,
});

/**
 * Stripe Webhook Handler
 * 
 * POST /api/stripe/webhook
 * 
 * Handles:
 * - checkout.session.completed → grant credits for one-time or first subscription payment
 * - invoice.payment_succeeded → grant credits for subscription renewals
 * - customer.subscription.deleted → downgrade user on cancel
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    let event: Stripe.Event;

    // If we have a webhook secret, verify the signature
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err) {
        console.error('❌ Stripe webhook signature verification failed:', err);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    } else {
      // In sandbox/development without webhook secret, parse directly
      console.warn('⚠️ STRIPE_WEBHOOK_SECRET not set — processing without signature verification');
      event = JSON.parse(body) as Stripe.Event;
    }

    console.log('📧 Stripe webhook received:', {
      type: event.type,
      id: event.id,
    });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        // Only handle renewal invoices (not the first one which is handled by checkout.session.completed)
        if (invoice.billing_reason === 'subscription_cycle') {
          await handleSubscriptionRenewal(invoice);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      default:
        console.log(`ℹ️ Unhandled Stripe event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ Stripe webhook processing error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

/**
 * Handle checkout.session.completed
 * Grants credits for both one-time purchases and initial subscriptions
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const planId = session.metadata?.plan_id;
  const billingCycle = session.metadata?.billing_cycle || 'monthly';
  const planType = session.metadata?.plan_type || 'subscription';
  const sessionId = session.id;

  if (!userId || !planId) {
    console.error('❌ Missing user_id or plan_id in session metadata:', session.metadata);
    return;
  }

  // Prevent duplicate processing
  const txRef = adminDb.collection('stripe_transactions').doc(sessionId);
  const existingTx = await txRef.get();
  if (existingTx.exists) {
    console.log(`✅ Session ${sessionId} already processed`);
    return;
  }

  const isPayAsYouGo = planType === 'pay-as-you-go' || planId.startsWith('pack-');

  const plan = isPayAsYouGo
    ? payAsYouGoPacks.find(p => p.id === planId)
    : paymentTiers.find(p => p.id === planId);

  if (!plan) {
    console.error(`❌ Plan not found: ${planId}`);
    return;
  }

  // Grant credits
  await addCredits(userId, plan.imageCredits, plan.videoCredits);

  if (isPayAsYouGo) {
    // Pay-as-you-go: just record the purchase, don't change tier
    await adminDb.collection('users').doc(userId).update({
      lastPaymentDate: new Date().toISOString(),
    });
    console.log(`💰 Pay-as-you-go: Granted ${plan.imageCredits} image + ${plan.videoCredits} video credits to ${userId}`);
  } else {
    // Subscription: update tier
    await adminDb.collection('users').doc(userId).update({
      tier: planId as 'starter' | 'standard' | 'pro',
      subscriptionType: billingCycle as 'monthly' | 'annual',
      planId,
      subscriptionStartDate: new Date().toISOString(),
      lastPaymentDate: new Date().toISOString(),
      stripeCustomerId: session.customer as string || '',
      stripeSubscriptionId: session.subscription as string || '',
    });
    console.log(`🎉 Subscription: Upgraded ${userId} to ${plan.name} (${billingCycle}), granted ${plan.imageCredits} image + ${plan.videoCredits} video credits`);
  }

  // Record transaction
  await txRef.set({
    userId,
    sessionId,
    planId,
    planType: isPayAsYouGo ? 'pay-as-you-go' : 'subscription',
    billingCycle,
    amount: (session.amount_total || 0) / 100,
    currency: session.currency,
    stripeCustomerId: session.customer || null,
    stripeSubscriptionId: session.subscription || null,
    processedAt: new Date().toISOString(),
  });
}

/**
 * Handle subscription renewal (invoice.payment_succeeded with billing_reason=subscription_cycle)
 */
async function handleSubscriptionRenewal(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  // Look up the subscription metadata for user_id and plan_id
  let userId: string | undefined;
  let planId: string | undefined;
  let billingCycle: string | undefined;

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    userId = subscription.metadata?.user_id;
    planId = subscription.metadata?.plan_id;
    billingCycle = subscription.metadata?.billing_cycle || 'monthly';
  } catch (err) {
    console.error('❌ Failed to retrieve subscription:', err);
  }

  // Fallback: look up user by stripeSubscriptionId in Firestore
  if (!userId) {
    const usersSnapshot = await adminDb.collection('users')
      .where('stripeSubscriptionId', '==', subscriptionId)
      .limit(1)
      .get();
    if (!usersSnapshot.empty) {
      const doc = usersSnapshot.docs[0];
      userId = doc.id;
      planId = planId || doc.data().planId;
      billingCycle = billingCycle || doc.data().subscriptionType;
    }
  }

  if (!userId || !planId) {
    console.error('❌ Cannot find user for renewal. subscriptionId:', subscriptionId);
    return;
  }

  // Prevent duplicate
  const txRef = adminDb.collection('stripe_transactions').doc(invoice.id);
  const existingTx = await txRef.get();
  if (existingTx.exists) {
    console.log(`✅ Invoice ${invoice.id} already processed`);
    return;
  }

  const plan = paymentTiers.find(p => p.id === planId);
  if (!plan) {
    console.error(`❌ Plan not found for renewal: ${planId}`);
    return;
  }

  // Grant credits for renewal
  await addCredits(userId, plan.imageCredits, plan.videoCredits);

  await adminDb.collection('users').doc(userId).update({
    lastPaymentDate: new Date().toISOString(),
  });

  await txRef.set({
    userId,
    invoiceId: invoice.id,
    planId,
    billingCycle,
    amount: (invoice.amount_paid || 0) / 100,
    currency: invoice.currency,
    type: 'renewal',
    processedAt: new Date().toISOString(),
  });

  console.log(`🔄 Renewal: Granted ${plan.imageCredits} image + ${plan.videoCredits} video credits to ${userId}`);
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;

  let uid = userId;
  if (!uid) {
    const usersSnapshot = await adminDb.collection('users')
      .where('stripeSubscriptionId', '==', subscription.id)
      .limit(1)
      .get();
    if (!usersSnapshot.empty) {
      uid = usersSnapshot.docs[0].id;
    }
  }

  if (!uid) {
    console.error('❌ Cannot find user for subscription cancellation:', subscription.id);
    return;
  }

  await adminDb.collection('users').doc(uid).update({
    tier: 'free',
    subscriptionType: null,
    planId: null,
    stripeSubscriptionId: null,
  });

  console.log(`🚫 Subscription canceled for user ${uid}`);
}

// Verification GET
export async function GET() {
  return NextResponse.json({
    message: 'Stripe webhook endpoint is active',
    endpoint: '/api/stripe/webhook',
  });
}
