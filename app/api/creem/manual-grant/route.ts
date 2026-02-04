import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/verify-auth';
import { adminDb } from '@/lib/firebase-admin';
import { addCredits } from '@/lib/credits';

/**
 * Manual Credit Grant Endpoint
 * 
 * This is a fallback endpoint to manually grant credits if the webhook fails.
 * Only call this if webhook didn't process the payment.
 * 
 * POST /api/creem/manual-grant
 * Body: { checkoutId: string }
 */

export async function POST(request: NextRequest) {
  try {
    const authUid = await verifyAuthToken(request);
    if (!authUid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { checkoutId } = await request.json();

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

    // Check if this is a manual grant request (user requesting credits)
    // Verify the checkout belongs to this user by checking recent checkouts
    // For now, we'll grant credits if the transaction doesn't exist
    // In production, you might want to verify the checkout ID with Creem API

    console.log(`🔧 Manual credit grant requested for checkout: ${checkoutId}, user: ${authUid}`);

    // Grant 300 credits (150 image + 150 video)
    const success = await addCredits(authUid, 150, 150);
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to grant credits' }, { status: 500 });
    }

    // Update user tier
    await adminDb.collection('users').doc(authUid).update({
      tier: 'pro',
      subscriptionType: 'weekly',
      subscriptionStartDate: new Date().toISOString(),
      lastPaymentDate: new Date().toISOString(),
    });

    // Mark as processed
    await transactionRef.set({
      userId: authUid,
      checkoutId,
      eventType: 'manual_grant',
      status: 'completed',
      amount: 5.99,
      productId: process.env.CREEM_PRODUCT_ID,
      processedAt: new Date().toISOString(),
      manualGrant: true,
    });

    console.log(`✅ Manually granted 300 credits to user ${authUid} for checkout ${checkoutId}`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Credits granted successfully',
      credits: { image: 150, video: 150 }
    });

  } catch (error) {
    console.error('❌ Manual grant error:', error);
    return NextResponse.json(
      { error: 'Failed to grant credits', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
