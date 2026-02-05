'use client';

import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { paymentTiers, payAsYouGoPacks, PaymentTier, getAllPlans } from '@/lib/payment';
import { useUser } from '@/hooks/useUser';
import { trackEvent } from '@/lib/analytics';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PaymentModal({ isOpen, onClose }: PaymentModalProps) {
  const { user } = useUser();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedTier, setSelectedTier] = useState<string>('standard'); // Default to Standard
  const [showPayAsYouGo, setShowPayAsYouGo] = useState(false); // Toggle between subscriptions and pay-as-you-go
  const [creemUrl, setCreemUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Track when payment modal opens
  useEffect(() => {
    if (isOpen) {
      trackEvent('pricing_modal_opened', {
        source: 'payment_modal',
        user_tier: user?.tier || 'free',
      });
    }
  }, [isOpen, user?.tier]);

  // Track plan selection
  useEffect(() => {
    if (isOpen && selectedTier) {
      trackEvent('pricing_plan_selected', {
        plan_id: selectedTier,
        billing_cycle: billingCycle,
        user_tier: user?.tier || 'free',
      });
    }
  }, [selectedTier, billingCycle, isOpen, user?.tier]);

  // Track billing cycle change
  useEffect(() => {
    if (isOpen && billingCycle) {
      trackEvent('pricing_billing_cycle_changed', {
        billing_cycle: billingCycle,
        plan_id: selectedTier,
      });
    }
  }, [billingCycle, isOpen, selectedTier]);

  useEffect(() => {
    const fetchCreemUrl = async () => {
      if (isOpen && user?.id && selectedTier) {
        setIsLoading(true);
        setError('');
        try {
          // Get auth token
          const { auth } = await import('@/lib/firebase');
          const { getIdToken } = await import('firebase/auth');
          const idToken = auth?.currentUser ? await getIdToken(auth.currentUser) : null;

          if (!idToken) {
            setError('Please sign in to continue');
            setIsLoading(false);
            return;
          }

          // Fetch Creem checkout URL from API
          // Note: You'll need to create products in Creem for each plan
          const billing = showPayAsYouGo ? 'one-time' : billingCycle;
          const response = await fetch(`/api/creem/get-checkout-url?userId=${user.id}&planId=${selectedTier}&billing=${billing}`, {
            headers: {
              'Authorization': `Bearer ${idToken}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.url) {
              setCreemUrl(data.url);
            } else {
              setError('Failed to get checkout URL. Please try again.');
            }
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            const errorMessage = errorData.error || errorData.details || 'Failed to connect to payment service';
            setError(errorMessage);
            console.error('Failed to get Creem checkout URL:', errorData);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Network error. Please check your connection.';
          setError(errorMessage);
          console.error('Error fetching Creem checkout URL:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchCreemUrl();
  }, [isOpen, user?.id, selectedTier, billingCycle, showPayAsYouGo]);

  if (!isOpen) return null;

  const handleCreemClick = () => {
    if (creemUrl && user?.id) {
      // Track checkout button click
      const allPlans = [...paymentTiers, ...payAsYouGoPacks];
      const selectedPlan = allPlans.find(t => t.id === selectedTier);
      trackEvent('pricing_checkout_clicked', {
        plan_id: selectedTier,
        plan_name: selectedPlan?.name || selectedTier,
        billing_cycle: showPayAsYouGo ? 'one-time' : billingCycle,
        plan_type: showPayAsYouGo ? 'pay-as-you-go' : 'subscription',
        price: selectedPlan?.price || 0,
        user_tier: user?.tier || 'free',
      });
      
      // Redirect to Creem checkout
      window.location.href = creemUrl;
    }
  };

  const getPrice = (tier: PaymentTier) => {
    return billingCycle === 'annual' && tier.annualPrice 
      ? tier.annualPrice 
      : tier.price;
  };

  const getPriceLabel = (tier: PaymentTier) => {
    if (billingCycle === 'annual' && tier.annualPrice) {
      return `$${tier.annualPrice}/year`;
    }
    return `$${tier.price}/month`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg max-w-5xl w-full p-6 relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-2xl font-bold mb-2 text-center">Choose Your Plan</h2>
        <p className="text-gray-400 text-sm mb-6 text-center">Select a plan that fits your needs</p>

        {/* Subscription vs Pay-As-You-Go Toggle */}
        <div className="flex justify-center mb-4">
          <div className="bg-gray-700 rounded-lg p-1 inline-flex gap-1">
            <button
              onClick={() => {
                setShowPayAsYouGo(false);
                setSelectedTier('standard'); // Reset to default
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                !showPayAsYouGo
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Subscriptions
            </button>
            <button
              onClick={() => {
                setShowPayAsYouGo(true);
                setSelectedTier('pack-medium'); // Default to medium pack
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                showPayAsYouGo
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Pay-As-You-Go
            </button>
          </div>
        </div>

        {/* Billing Cycle Toggle (only for subscriptions) */}
        {!showPayAsYouGo && (
          <div className="flex justify-center mb-6">
            <div className="bg-gray-700 rounded-lg p-1 inline-flex gap-1">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingCycle === 'monthly'
                    ? 'bg-primary text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingCycle === 'annual'
                    ? 'bg-primary text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Annual <span className="text-xs text-green-400">(20% off)</span>
              </button>
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {(showPayAsYouGo ? payAsYouGoPacks : paymentTiers).map((tier) => {
            const isSelected = selectedTier === tier.id;
            const price = getPrice(tier);
            const priceLabel = getPriceLabel(tier);
            const savings = billingCycle === 'annual' && tier.annualPrice 
              ? ((tier.price * 12) - tier.annualPrice).toFixed(0)
              : null;

            return (
              <div
                key={tier.id}
                onClick={() => setSelectedTier(tier.id)}
                className={`bg-gray-700 rounded-lg p-6 border-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/50'
                    : 'border-gray-600 hover:border-gray-500'
                } ${tier.popular ? 'relative' : ''}`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </div>
                )}

                <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold">${price}</span>
                  <span className="text-gray-400 text-sm">
                    {showPayAsYouGo ? ' one-time' : billingCycle === 'annual' ? '/year' : '/month'}
                  </span>
                  {savings && !showPayAsYouGo && (
                    <div className="text-xs text-green-400 mt-1">
                      Save ${savings}/year
                    </div>
                  )}
                </div>

                <div className="mb-4 space-y-2">
                  <div className="text-sm text-gray-300">
                    <span className="font-semibold">{tier.imageCredits.toLocaleString()}</span> Image Credits{showPayAsYouGo ? '' : '/month'}
                  </div>
                  <div className="text-sm text-gray-300">
                    <span className="font-semibold">{tier.videoCredits.toLocaleString()}</span> Video Credits{showPayAsYouGo ? '' : '/month'} ({tier.videosPerMonth} videos)
                  </div>
                  {!showPayAsYouGo && (
                    <div className="text-sm text-gray-300">
                      ~<span className="font-semibold">{tier.videosPerMonth}</span> videos/month
                    </div>
                  )}
                  <div className="text-xs text-gray-400">
                    ${tier.perVideoCost}/video
                  </div>
                  {tier.videoResolution && (
                    <div className="text-xs text-gray-400">
                      {tier.videoResolution} quality
                    </div>
                  )}
                  {tier.generationSpeed && (
                    <div className="text-xs text-gray-400">
                      {tier.generationSpeed} speed
                    </div>
                  )}
                </div>

                <ul className="space-y-2 mb-6">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {isSelected && (
                  <div className="bg-primary/20 border border-primary/50 rounded-lg p-2 text-center text-sm text-primary font-semibold">
                    Selected
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Checkout Button */}
        {user?.id ? (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                <p className="text-red-300 text-sm">{error}</p>
                <p className="text-red-400 text-xs mt-1">
                  Check browser console for details. Make sure environment variables are set in Vercel.
                </p>
              </div>
            )}
            <button
              onClick={handleCreemClick}
              disabled={isLoading || !creemUrl}
              className="w-full bg-primary hover:bg-primary-dark disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Loading...
                </>
              ) : creemUrl ? (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  Subscribe with Creem
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                  {error ? 'Error - Check Console' : 'Preparing...'}
                </>
              )}
            </button>
          </>
        ) : (
          <p className="text-center text-gray-400 text-sm">Please sign in to upgrade</p>
        )}
      </div>
    </div>
  );
}
