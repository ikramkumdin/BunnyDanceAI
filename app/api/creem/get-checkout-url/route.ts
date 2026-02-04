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
      console.error('❌ Creem checkout: Unauthorized - No auth token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const planId = searchParams.get('planId') || 'standard'; // Default to standard
    const billingCycle = searchParams.get('billing') || 'monthly'; // Default to monthly

    if (!userId) {
      console.error('❌ Creem checkout: User ID is required');
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (userId !== authUid) {
      console.error('❌ Creem checkout: User ID mismatch', { userId, authUid });
      return NextResponse.json({ error: 'Unauthorized: User ID mismatch' }, { status: 403 });
    }

    // Validate planId
    const validPlans = ['starter', 'standard', 'pro'];
    if (!validPlans.includes(planId)) {
      console.error('❌ Creem checkout: Invalid plan ID', { planId });
      return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 });
    }

    // Validate billingCycle
    if (billingCycle !== 'monthly' && billingCycle !== 'annual') {
      console.error('❌ Creem checkout: Invalid billing cycle', { billingCycle });
      return NextResponse.json({ error: 'Invalid billing cycle' }, { status: 400 });
    }

    // Check environment variables before calling Creem API
    const creemApiKey = process.env.CREEM_API_KEY;
    // Note: You'll need to create products in Creem for each plan and store their IDs
    // For now, we'll use a single product ID or you can create a mapping
    const creemProductId = process.env.CREEM_PRODUCT_ID;

    if (!creemApiKey) {
      console.error('❌ Creem checkout: CREEM_API_KEY is not set in environment variables');
      return NextResponse.json(
        { 
          error: 'Payment service configuration error', 
          details: 'CREEM_API_KEY is not configured. Please contact support.' 
        },
        { status: 500 }
      );
    }

    if (!creemProductId) {
      console.error('❌ Creem checkout: CREEM_PRODUCT_ID is not set in environment variables');
      return NextResponse.json(
        { 
          error: 'Payment service configuration error', 
          details: 'CREEM_PRODUCT_ID is not configured. Please contact support.' 
        },
        { status: 500 }
      );
    }

    console.log('✅ Creem checkout: Environment variables are set, calling Creem API...', {
      userId,
      planId,
      billingCycle,
    });
    const checkoutUrl = await generateCreemCheckoutUrl(userId, planId, billingCycle);

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    console.error('❌ Creem checkout: Error generating checkout URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Creem checkout: Error details:', errorMessage);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate checkout URL', 
        details: errorMessage,
        hint: 'Check Vercel logs for more details. Ensure CREEM_API_KEY and CREEM_PRODUCT_ID are set.'
      },
      { status: 500 }
    );
  }
}
