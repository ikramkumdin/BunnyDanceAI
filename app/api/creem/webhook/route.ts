import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { addCredits } from '@/lib/credits';
import { paymentTiers, payAsYouGoPacks, PaymentTier } from '@/lib/payment';
import { verifyCreemWebhook } from '@/lib/creem';

/**
 * Creem Webhook Handler
 *
 * Receives payment notifications from Creem.
 * Configure this URL in Creem dashboard → Developers → Webhook:
 *   https://www.waifudance.com/api/creem/webhook
 *
 * Creem event types handled:
 *   checkout.completed   – initial purchase (one-time or first subscription)
 *   subscription.paid    – recurring subscription renewal
 *   subscription.canceled – user canceled subscription
 */

export async function POST(request: NextRequest) {
  try {
    // ── 1. Read raw body for signature verification ────────────────────
    const rawBody = await request.text();
    const signature = request.headers.get('creem-signature') || '';

    if (!verifyCreemWebhook(rawBody, signature)) {
      console.error('❌ Creem webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // ── 2. Parse body ─────────────────────────────────────────────────
    const body = JSON.parse(rawBody);

    console.log('📧 Creem webhook received:', JSON.stringify(body, null, 2));

    // Creem wraps events as { event_type, data: { ... } } or flat payload
    // Accept both shapes
    const eventType: string = body.event_type || body.type || body.event || '';
    const data = body.data || body; // data may be nested or flat

    // ── 3. Route by event type ────────────────────────────────────────
    if (eventType === 'checkout.completed') {
      await handleCheckoutCompleted(data);
    } else if (eventType === 'subscription.paid') {
      await handleSubscriptionPaid(data);
    } else if (eventType === 'subscription.canceled') {
      await handleSubscriptionCanceled(data);
    } else {
      console.log(`ℹ️ Unhandled Creem event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ Creem webhook processing error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

// ─── Helpers to extract fields from varied payload shapes ──────────────

function extractId(data: any): string {
  return data.id || data.checkout_id || data.checkout?.id || '';
}

function extractUserId(data: any): string | null {
  return (
    data.metadata?.user_id ||
    data.metadata?.['user_id'] ||
    data.custom_data?.user_id ||
    data.user_id ||
    null
  );
}

function extractAmount(data: any): number {
  // Creem may return amount in cents in order object
  const orderAmount = data.order?.amount ?? data.order?.amount_paid;
  if (typeof orderAmount === 'number') return orderAmount / 100; // cents → dollars
  // Fallback to top-level amount (may already be dollars)
  const raw = data.amount ?? data.total_amount ?? 0;
  return typeof raw === 'string' ? parseFloat(raw) : raw;
}

// ─── checkout.completed ───────────────────────────────────────────────

async function handleCheckoutCompleted(data: any) {
  const checkoutId = extractId(data);
  let userId = extractUserId(data);
  const amount = extractAmount(data);

  // Plan info from metadata
  let planId = data.metadata?.plan_id;
  let billingCycle = data.metadata?.billing_cycle || 'monthly';
  let isPayAsYouGo = planId?.startsWith('pack-') || billingCycle === 'one-time';

  // If no planId in metadata, match by amount
  if (!planId) {
    const matched = matchPlanByAmount(amount);
    if (matched) {
      planId = matched.planId;
      billingCycle = matched.billingCycle;
      isPayAsYouGo = matched.isPayAsYouGo;
    }
  }

  // Fallback: look up user by email
  if (!userId) {
    const email = data.customer?.email || data.email;
    if (email) userId = await findUserByEmail(email);
  }

  if (!userId) {
    console.error('❌ checkout.completed: no user_id. payload:', JSON.stringify(data));
    return;
  }
  if (!planId) {
    console.error(`❌ checkout.completed: cannot determine plan. amount=${amount}`);
    return;
  }
  if (!checkoutId) {
    console.error('❌ checkout.completed: missing checkout id');
    return;
  }

  // De-dup
  const txRef = adminDb.collection('creem_transactions').doc(checkoutId);
  if ((await txRef.get()).exists) {
    console.log(`✅ checkout ${checkoutId} already processed`);
    return;
  }

  const plan = isPayAsYouGo
    ? payAsYouGoPacks.find(t => t.id === planId)
    : paymentTiers.find(t => t.id === planId);

  if (!plan) {
    console.error(`❌ Plan not found: ${planId}`);
    return;
  }

  // Grant credits
  await addCredits(userId, plan.imageCredits, plan.videoCredits);

  if (isPayAsYouGo) {
    await adminDb.collection('users').doc(userId).update({
      lastPaymentDate: new Date().toISOString(),
    });
    console.log(`💰 Pay-as-you-go: granted ${plan.imageCredits} img + ${plan.videoCredits} vid credits to ${userId}`);
  } else {
    await adminDb.collection('users').doc(userId).update({
      tier: planId as 'starter' | 'standard' | 'pro',
      subscriptionType: billingCycle as 'monthly' | 'annual',
      planId,
      subscriptionStartDate: new Date().toISOString(),
      lastPaymentDate: new Date().toISOString(),
    });
    console.log(`🎉 Subscription: upgraded ${userId} to ${plan.name} (${billingCycle}), granted ${plan.imageCredits} img + ${plan.videoCredits} vid`);
  }

  await txRef.set({
    userId,
    checkoutId,
    eventType: 'checkout.completed',
    planId,
    billingCycle,
    amount,
    processedAt: new Date().toISOString(),
  });
}

// ─── subscription.paid (renewal) ──────────────────────────────────────

async function handleSubscriptionPaid(data: any) {
  const subscriptionId = data.id || data.subscription?.id || data.subscription || '';
  let userId = extractUserId(data);
  const amount = extractAmount(data);

  let planId = data.metadata?.plan_id;
  let billingCycle = data.metadata?.billing_cycle || 'monthly';

  if (!userId) {
    const email = data.customer?.email || data.email;
    if (email) userId = await findUserByEmail(email);
  }
  if (!userId) {
    console.error('❌ subscription.paid: no user_id');
    return;
  }

  // Try to determine plan from metadata or amount
  if (!planId) {
    const matched = matchPlanByAmount(amount);
    if (matched && !matched.isPayAsYouGo) {
      planId = matched.planId;
      billingCycle = matched.billingCycle;
    }
  }
  // Last resort: read from user doc
  if (!planId) {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    planId = userDoc.data()?.planId;
    billingCycle = userDoc.data()?.subscriptionType || 'monthly';
  }

  if (!planId) {
    console.error('❌ subscription.paid: cannot determine plan');
    return;
  }

  // De-dup using subscription + timestamp
  const txId = `${subscriptionId}_${Date.now()}`;
  const txRef = adminDb.collection('creem_transactions').doc(txId);

  const plan = paymentTiers.find(t => t.id === planId);
  if (!plan) {
    console.error(`❌ subscription.paid: plan not found: ${planId}`);
    return;
  }

  await addCredits(userId, plan.imageCredits, plan.videoCredits);
  await adminDb.collection('users').doc(userId).update({
    lastPaymentDate: new Date().toISOString(),
  });

  await txRef.set({
    userId,
    subscriptionId,
    eventType: 'subscription.paid',
    planId,
    billingCycle,
    amount,
    processedAt: new Date().toISOString(),
  });

  console.log(`🔄 Renewal: granted ${plan.imageCredits} img + ${plan.videoCredits} vid credits to ${userId}`);
}

// ─── subscription.canceled ────────────────────────────────────────────

async function handleSubscriptionCanceled(data: any) {
  let userId = extractUserId(data);

  if (!userId) {
    const email = data.customer?.email || data.email;
    if (email) userId = await findUserByEmail(email);
  }
  if (!userId) {
    console.error('❌ subscription.canceled: no user_id');
    return;
  }

  await adminDb.collection('users').doc(userId).update({
    tier: 'free',
    subscriptionType: null,
    planId: null,
  });

  console.log(`🚫 Subscription canceled for user ${userId}`);
}

// ─── Utility: match plan by dollar amount ─────────────────────────────

function matchPlanByAmount(amount: number): { planId: string; billingCycle: string; isPayAsYouGo: boolean } | null {
  const close = (a: number, b: number) => Math.abs(a - b) < 1;

  // Pay-as-you-go packs
  if (close(amount, 4))   return { planId: 'pack-basic',   billingCycle: 'one-time', isPayAsYouGo: true };
  if (close(amount, 16))  return { planId: 'pack-plus',    billingCycle: 'one-time', isPayAsYouGo: true };
  if (close(amount, 40))  return { planId: 'pack-premium', billingCycle: 'one-time', isPayAsYouGo: true };
  // Monthly subscriptions
  if (close(amount, 9))   return { planId: 'starter',  billingCycle: 'monthly', isPayAsYouGo: false };
  if (close(amount, 24))  return { planId: 'standard', billingCycle: 'monthly', isPayAsYouGo: false };
  if (close(amount, 48))  return { planId: 'pro',      billingCycle: 'monthly', isPayAsYouGo: false };
  // Annual subscriptions
  if (close(amount, 86))  return { planId: 'starter',  billingCycle: 'annual', isPayAsYouGo: false };
  if (close(amount, 230)) return { planId: 'standard', billingCycle: 'annual', isPayAsYouGo: false };
  if (close(amount, 461)) return { planId: 'pro',      billingCycle: 'annual', isPayAsYouGo: false };

  return null;
}

// ─── Utility: find user by email ──────────────────────────────────────

async function findUserByEmail(email: string): Promise<string | null> {
  try {
    const snapshot = await adminDb.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();
    if (!snapshot.empty) {
      console.log(`✅ Found user by email: ${snapshot.docs[0].id}`);
      return snapshot.docs[0].id;
    }
  } catch (e) {
    console.error('❌ Error finding user by email:', e);
  }
  return null;
}

// ─── GET (endpoint health check) ──────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    message: 'Creem webhook endpoint is active',
    endpoint: '/api/creem/webhook',
  });
}
