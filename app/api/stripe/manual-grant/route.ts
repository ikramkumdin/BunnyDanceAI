import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyAuthToken } from '@/lib/verify-auth';
import { adminDb } from '@/lib/firebase-admin';
import { addCredits } from '@/lib/credits';
import { paymentTiers, payAsYouGoPacks } from '@/lib/payment';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10' as any,
});

/**
 * Manual Credit Grant Endpoint (Stripe fallback)
 * 
 * If the webhook didn't process a payment, the success page can call this
 * to verify the session with Stripe and grant credits.
 * 
 * POST /api/stripe/manual-grant
 * Body: { sessionId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const authUid = await verifyAuthToken(request);
    if (!authUid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Check if already processed
    const txRef = adminDb.collection('stripe_transactions').doc(sessionId);
    const existingTx = await txRef.get();
    if (existingTx.exists) {
      console.log(`✅ Session ${sessionId} already processed via webhook`);
      return NextResponse.json({
        success: true,
        message: 'Credits already granted via webhook',
        alreadyProcessed: true,
      });
    }

    // Verify the session with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
    }

    // Verify user matches
    const sessionUserId = session.metadata?.user_id;
    if (sessionUserId !== authUid) {
      return NextResponse.json({ error: 'User mismatch' }, { status: 403 });
    }

    const planId = session.metadata?.plan_id;
    const billingCycle = session.metadata?.billing_cycle || 'monthly';
    const planType = session.metadata?.plan_type || 'subscription';

    if (!planId) {
      return NextResponse.json({ error: 'No plan in session' }, { status: 400 });
    }

    const isPayAsYouGo = planType === 'pay-as-you-go' || planId.startsWith('pack-');
    const plan = isPayAsYouGo
      ? payAsYouGoPacks.find(p => p.id === planId)
      : paymentTiers.find(p => p.id === planId);

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 400 });
    }

    // Grant credits
    const success = await addCredits(authUid, plan.imageCredits, plan.videoCredits);
    if (!success) {
      return NextResponse.json({ error: 'Failed to grant credits' }, { status: 500 });
    }

    if (!isPayAsYouGo) {
      await adminDb.collection('users').doc(authUid).update({
        tier: planId as 'starter' | 'standard' | 'pro',
        subscriptionType: billingCycle as 'monthly' | 'annual',
        planId,
        subscriptionStartDate: new Date().toISOString(),
        lastPaymentDate: new Date().toISOString(),
        stripeCustomerId: session.customer as string || '',
        stripeSubscriptionId: session.subscription as string || '',
      });
    } else {
      await adminDb.collection('users').doc(authUid).update({
        lastPaymentDate: new Date().toISOString(),
      });
    }

    // Record transaction
    await txRef.set({
      userId: authUid,
      sessionId,
      planId,
      planType: isPayAsYouGo ? 'pay-as-you-go' : 'subscription',
      billingCycle,
      amount: (session.amount_total || 0) / 100,
      currency: session.currency,
      stripeCustomerId: session.customer || null,
      stripeSubscriptionId: session.subscription || null,
      manualGrant: true,
      processedAt: new Date().toISOString(),
    });

    console.log(`✅ Manually granted ${plan.imageCredits} image + ${plan.videoCredits} video credits to ${authUid}`);

    return NextResponse.json({
      success: true,
      message: 'Credits granted successfully',
      credits: { image: plan.imageCredits, video: plan.videoCredits },
    });
  } catch (error) {
    console.error('❌ Stripe manual grant error:', error);
    return NextResponse.json(
      { error: 'Failed to grant credits', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
