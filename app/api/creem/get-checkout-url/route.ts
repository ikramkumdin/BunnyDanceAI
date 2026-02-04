import { NextRequest, NextResponse } from 'next/server';
import { generateCreemCheckoutUrl } from '@/lib/creem';
import { verifyAuthToken } from '@/lib/verify-auth';

/**
 * Creem Checkout URL Generator
 * 
 * This endpoint generates a Creem checkout URL for authenticated users
 * POST /api/creem/get-checkout-url
 */

export async function GET(request: NextRequest) {
  try {
    const authUid = await verifyAuthToken(request);
    if (!authUid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (userId !== authUid) {
      return NextResponse.json({ error: 'Unauthorized: User ID mismatch' }, { status: 403 });
    }

    const checkoutUrl = await generateCreemCheckoutUrl(userId);

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    console.error('Error generating Creem checkout URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate checkout URL', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
