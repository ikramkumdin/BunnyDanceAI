import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/verify-auth';
import { adminDb } from '@/lib/firebase-admin';
import { addCredits } from '@/lib/credits';
import { paymentTiers, payAsYouGoPacks } from '@/lib/payment';

/**
 * Manual Credit Grant Endpoint
 * 
 * This is a fallback endpoint to manually grant credits if the webhook fails.
 * Only call this if webhook didn't process the payment.
 * 
 * POST /api/creem/manual-grant
 * Body: { checkoutId: string, planId?: string, billingCycle?: string }
 */

export async function POST(request: NextRequest) {
  try {
    const authUid = await verifyAuthToken(request);
    if (!authUid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { checkoutId, planId, billingCycle } = await request.json();

    if (!checkoutId) {
      return NextResponse.json({ error: 'Checkout ID is required' }, { status: 400 });
    }

    // Check if this transaction was already processed
    const transactionRef = adminDb.collection('creem_transactions').doc(checkoutId);
    const existingTxn = await transactionRef.get();
    
    if (existingTxn.exists) {
      console.log(`✅ Transaction ${checkoutId} already processed via webhook`);
      return NextResponse.json({ 
        success: true, 
        message: 'Credits already granted via webhook',
        alreadyProcessed: true 
      });
    }

    console.log(`🔧 Manual credit grant requested for checkout: ${checkoutId}, user: ${authUid}, plan: ${planId}, billing: ${billingCycle}`);

    // Look up the plan to determine correct credits
    const isPayAsYouGo = planId?.startsWith('pack-') || billingCycle === 'one-time';
    const allPlans = [...paymentTiers, ...payAsYouGoPacks];
    const plan = planId ? allPlans.find(p => p.id === planId) : null;

    if (!plan) {
      console.warn(`⚠️ Manual grant: plan '${planId}' not found, granting default starter credits`);
    }

    const imageCredits = plan?.imageCredits ?? 200;
    const videoCredits = plan?.videoCredits ?? 200;
    const tierName = isPayAsYouGo ? undefined : (planId as 'starter' | 'standard' | 'pro');

    // Grant credits
    const success = await addCredits(authUid, imageCredits, videoCredits);
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to grant credits' }, { status: 500 });
    }

    // Update user tier (only for subscriptions, not pay-as-you-go)
    if (tierName && !isPayAsYouGo) {
      await adminDb.collection('users').doc(authUid).update({
        tier: tierName,
        subscriptionType: billingCycle || 'monthly',
        planId: planId,
        subscriptionStartDate: new Date().toISOString(),
        lastPaymentDate: new Date().toISOString(),
      });
    } else {
      await adminDb.collection('users').doc(authUid).update({
        lastPaymentDate: new Date().toISOString(),
      });
    }

    // Mark as processed
    await transactionRef.set({
      userId: authUid,
      checkoutId,
      eventType: 'manual_grant',
      status: 'completed',
      planId: planId || 'unknown',
      billingCycle: billingCycle || 'unknown',
      productId: process.env.CREEM_PRODUCT_ID,
      processedAt: new Date().toISOString(),
      manualGrant: true,
    });

    console.log(`✅ Manually granted ${imageCredits} img + ${videoCredits} vid credits to ${authUid} (plan: ${planId})`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Credits granted successfully',
      credits: { image: imageCredits, video: videoCredits }
    });

  } catch (error) {
    console.error('❌ Manual grant error:', error);
    return NextResponse.json(
      { error: 'Failed to grant credits', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
