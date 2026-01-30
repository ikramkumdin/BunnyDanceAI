import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/verify-auth';
import { generatePayPalButtonUrl, getPayPalMode } from '@/lib/paypal';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authUid = await verifyAuthToken(request);
    if (!authUid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const useSandbox = searchParams.get('sandbox') === 'true';

    if (!userId || userId !== authUid) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 403 });
    }

    const isSandbox = useSandbox !== undefined ? useSandbox : getPayPalMode() === 'sandbox';
    const paypalUrl = generatePayPalButtonUrl(userId, isSandbox);

    return NextResponse.json({ url: paypalUrl });
  } catch (error) {
    console.error('Error generating PayPal URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate PayPal URL' },
      { status: 500 }
    );
  }
}
