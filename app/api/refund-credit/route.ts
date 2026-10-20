import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/verify-auth';
import { addCredits, CREDIT_COSTS } from '@/lib/credits';

/**
 * Refund credits when a generation fails.
 * v6 unified pool: refund the full generation cost (not the old 1-credit
 * placeholder that under-refunded videos by ~19 credits).
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authUid = await verifyAuthToken(request);
    if (!authUid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, taskId, resolution } = await request.json();

    if (!type || (type !== 'image' && type !== 'video')) {
      return NextResponse.json(
        { error: 'Invalid credit type. Must be "image" or "video"' },
        { status: 400 }
      );
    }

    const amount = type === 'image'
      ? CREDIT_COSTS.IMAGE
      : (resolution === '720p' ? CREDIT_COSTS.VIDEO_720P : CREDIT_COSTS.VIDEO_480P);

    // Refund as subscription credits (we can't tell what pool the user
    // originally spent from without a transaction log; subscription is
    // the safer bucket since it's less of a windfall than PAYG).
    const success = await addCredits(authUid, amount, 'subscription');

    if (!success) {
      return NextResponse.json({ error: 'Failed to refund credit' }, { status: 500 });
    }

    console.log(`💳 Refunded ${amount} credits to user ${authUid} for failed ${type} task ${taskId || 'unknown'}`);
    return NextResponse.json({
      success: true,
      message: `Refunded ${amount} credits`,
      amount,
    });
  } catch (error) {
    console.error('❌ Refund credit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
