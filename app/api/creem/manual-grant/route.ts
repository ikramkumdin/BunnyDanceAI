import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/verify-auth';
import { adminDb } from '@/lib/firebase-admin';
import { addCredits } from '@/lib/credits';
import { paymentTiers, payAsYouGoPacks } from '@/lib/payment';
import { fetchCreemCheckout, expectedProductId } from '@/lib/creem';

/**
 * Manual Credit Grant Endpoint
 *
 * Fallback used by the success page when the Creem webhook hasn't landed
 * yet. Verifies server-side that the checkoutId sent by the client
 * corresponds to a real, paid Creem checkout for THIS user before granting —
 * without that check, a signed-in user could POST any fake checkoutId and
 * trigger credits (the client gate on /payment/success stops the UI from
 * calling us with a fake id, but a direct POST would bypass that).
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

    if (!checkoutId || typeof checkoutId !== 'string' || checkoutId.length > 128) {
      return NextResponse.json({ error: 'Checkout ID is required' }, { status: 400 });
    }
    // Reject the un-substituted template literal that older cached success
    // URLs still carry — treat it as a bad request, not a real checkout.
    if (checkoutId.startsWith('{') || !checkoutId.startsWith('ch_')) {
      return NextResponse.json({ error: 'Invalid checkout id' }, { status: 400 });
    }

    // Idempotency: webhook may already have granted. De-dup keyed by Creem's
    // real checkout id.
    const transactionRef = adminDb.collection('creem_transactions').doc(checkoutId);
    const existingTxn = await transactionRef.get();
    if (existingTxn.exists) {
      console.log(`✅ Transaction ${checkoutId} already processed`);
      return NextResponse.json({
        success: true,
        message: 'Credits already granted',
        alreadyProcessed: true,
      });
    }

    // Resolve the plan the client claims this checkout corresponds to.
    const isPayAsYouGo = planId?.startsWith('pack-') || billingCycle === 'one-time';
    const allPlans = [...paymentTiers, ...payAsYouGoPacks];
    const plan = planId ? allPlans.find((p) => p.id === planId) : null;
    if (!plan || !planId) {
      return NextResponse.json(
        { error: 'Unknown plan', planId: planId ?? null },
        { status: 400 }
      );
    }

    // ── Server-side verification against Creem's API ────────────────────
    // Ask Creem whether this checkout actually exists and whether it is
    // paid. If the API call fails outright (missing key, network blip)
    // we fail closed — the webhook will still land independently.
    const checkout = await fetchCreemCheckout(checkoutId);
    if (!checkout) {
      return NextResponse.json(
        { error: 'Checkout not found or verification unavailable' },
        { status: 403 }
      );
    }

    // 1. Checkout must be in a paid / completed state.
    //    Creem's docs may evolve; accept common synonyms.
    const PAID_STATUSES = new Set(['paid', 'completed', 'succeeded', 'complete']);
    const status = (checkout.status || checkout.order?.status || '').toLowerCase();
    if (!PAID_STATUSES.has(status)) {
      console.warn(`❌ manual-grant: checkout ${checkoutId} status=${status || '<missing>'}`);
      return NextResponse.json(
        { error: 'Checkout is not paid', status: status || null },
        { status: 403 }
      );
    }

    // 2. The Creem product on the checkout must match the planId the client
    //    claims — otherwise a user could pay for Taste ($5, 120cr) and ask
    //    us to grant Pro's 4000 credits instead.
    const checkoutProductId =
      checkout.product?.id || checkout.product_id || '';
    const expected = expectedProductId(planId, billingCycle || (isPayAsYouGo ? 'one-time' : 'monthly'));
    if (!expected || checkoutProductId !== expected) {
      console.warn(
        `❌ manual-grant: product mismatch for ${checkoutId}: got "${checkoutProductId}", expected "${expected}" (planId=${planId})`
      );
      return NextResponse.json(
        { error: 'Checkout does not match the claimed plan' },
        { status: 403 }
      );
    }

    // 3. The authenticated user must match the checkout's metadata.user_id
    //    (set when we generated the checkout). Prevents a signed-in user
    //    from grabbing credits for someone else's purchase.
    const metaUserId = (checkout.metadata?.user_id as string | undefined) || null;
    if (metaUserId && metaUserId !== authUid) {
      console.warn(
        `❌ manual-grant: user mismatch for ${checkoutId}: auth=${authUid}, metadata.user_id=${metaUserId}`
      );
      return NextResponse.json(
        { error: 'Checkout is not for this user' },
        { status: 403 }
      );
    }
    // If the checkout has no metadata.user_id at all, fall back to the
    // customer email check (addCredits is per-uid; the webhook handler
    // uses email fallback the same way, so this stays consistent).
    if (!metaUserId) {
      const checkoutEmail = checkout.customer?.email;
      const userDoc = await adminDb.collection('users').doc(authUid).get();
      const userEmail = userDoc.data()?.email;
      if (checkoutEmail && userEmail && checkoutEmail !== userEmail) {
        console.warn(
          `❌ manual-grant: email mismatch for ${checkoutId}: auth=${userEmail}, checkout=${checkoutEmail}`
        );
        return NextResponse.json(
          { error: 'Checkout is not for this user' },
          { status: 403 }
        );
      }
    }

    // ── Verified: grant credits ────────────────────────────────────────
    console.log(`🔧 Manual credit grant verified for checkout: ${checkoutId}, user: ${authUid}, plan: ${planId}, billing: ${billingCycle}`);

    const creditsToGrant = plan.credits;
    const tierName = isPayAsYouGo ? undefined : (planId as 'starter' | 'standard' | 'pro');

    const success = await addCredits(authUid, creditsToGrant, isPayAsYouGo ? 'payg' : 'subscription');
    if (!success) {
      return NextResponse.json({ error: 'Failed to grant credits' }, { status: 500 });
    }

    if (tierName && !isPayAsYouGo) {
      await adminDb.collection('users').doc(authUid).update({
        tier: tierName,
        subscriptionType: billingCycle || 'monthly',
        planId,
        subscriptionStartDate: new Date().toISOString(),
        lastPaymentDate: new Date().toISOString(),
      });
    } else {
      await adminDb.collection('users').doc(authUid).update({
        lastPaymentDate: new Date().toISOString(),
      });
    }

    await transactionRef.set({
      userId: authUid,
      checkoutId,
      eventType: 'manual_grant',
      status: 'completed',
      planId,
      billingCycle: billingCycle || (isPayAsYouGo ? 'one-time' : 'monthly'),
      productId: checkoutProductId,
      verifiedBy: 'creem-api',
      processedAt: new Date().toISOString(),
      manualGrant: true,
    });

    console.log(`✅ Manually granted ${creditsToGrant} credits to ${authUid} (plan: ${planId})`);

    return NextResponse.json({
      success: true,
      message: 'Credits granted successfully',
      credits: creditsToGrant,
      source: isPayAsYouGo ? 'payg' : 'subscription',
    });
  } catch (error) {
    console.error('❌ Manual grant error:', error);
    return NextResponse.json(
      { error: 'Failed to grant credits', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
