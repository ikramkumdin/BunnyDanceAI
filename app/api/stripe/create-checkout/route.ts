import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyAuthToken } from '@/lib/verify-auth';
import { paymentTiers, payAsYouGoPacks } from '@/lib/payment';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10' as any,
});

/**
 * Stripe Checkout Session Creator
 * 
 * POST /api/stripe/create-checkout
 * Body: { planId, billingCycle }
 * 
 * Creates a Stripe Checkout session and returns the URL for redirect.
 */
export async function POST(request: NextRequest) {
  try {
    const authUid = await verifyAuthToken(request);
    if (!authUid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId, billingCycle = 'monthly' } = await request.json();

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    // Determine if pay-as-you-go or subscription
    const isPayAsYouGo = planId.startsWith('pack-') || billingCycle === 'one-time';

    // Find the plan
    const plan = isPayAsYouGo
      ? payAsYouGoPacks.find(p => p.id === planId)
      : paymentTiers.find(p => p.id === planId);

    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 });
    }

    // Calculate amount in cents
    const amount = billingCycle === 'annual' && plan.annualPrice
      ? plan.annualPrice
      : plan.price;
    const amountInCents = Math.round(amount * 100);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3009';

    // Build Stripe Checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      mode: isPayAsYouGo ? 'payment' : 'subscription',
      success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payment/canceled`,
      metadata: {
        user_id: authUid,
        plan_id: planId,
        billing_cycle: billingCycle,
        plan_type: isPayAsYouGo ? 'pay-as-you-go' : 'subscription',
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: plan.name,
              description: `${plan.imageCredits} Image Credits + ${plan.videoCredits} Video Credits`,
            },
            unit_amount: amountInCents,
            ...(isPayAsYouGo
              ? {}
              : {
                  recurring: {
                    interval: billingCycle === 'annual' ? 'year' : 'month',
                  },
                }),
          },
          quantity: 1,
        },
      ],
    };

    // For subscriptions, pass metadata to the subscription too
    if (!isPayAsYouGo) {
      sessionParams.subscription_data = {
        metadata: {
          user_id: authUid,
          plan_id: planId,
          billing_cycle: billingCycle,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log('✅ Stripe checkout session created:', {
      sessionId: session.id,
      userId: authUid,
      planId,
      billingCycle,
      amount,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('❌ Stripe checkout error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create checkout session', details: errorMessage },
      { status: 500 }
    );
  }
}
