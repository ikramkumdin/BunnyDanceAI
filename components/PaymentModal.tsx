'use client';

import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { paymentTiers } from '@/lib/payment';
import { useUser } from '@/hooks/useUser';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PaymentModal({ isOpen, onClose }: PaymentModalProps) {
  const { user } = useUser();
  const [creemUrl, setCreemUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchCreemUrl = async () => {
      if (isOpen && user?.id) {
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
          const response = await fetch(`/api/creem/get-checkout-url?userId=${user.id}`, {
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
  }, [isOpen, user?.id]);

  if (!isOpen) return null;

  const tier = paymentTiers[0]; // Only weekly plan

  const handleCreemClick = () => {
    if (creemUrl && user?.id) {
      // Redirect to Creem checkout
      window.location.href = creemUrl;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-2xl font-bold mb-2">Upgrade to Pro Weekly</h2>
        <p className="text-gray-400 text-sm mb-6">Get 300 credits per week, billed weekly</p>
        
        <div className="bg-gray-700 rounded-lg p-6 border-2 border-primary ring-2 ring-primary/50 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
            BEST VALUE
          </div>
          
          <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
          <div className="mb-4">
            <span className="text-3xl font-bold">${tier.price}</span>
            <span className="text-gray-400">/week</span>
          </div>
          
          <ul className="space-y-2 mb-6">
            {tier.features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-gray-300">
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
          
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
    </div>
  );
}



