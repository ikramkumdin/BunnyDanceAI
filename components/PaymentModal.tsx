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
  const [paypalUrl, setPaypalUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchPayPalUrl = async () => {
      if (isOpen && user?.id) {
        setIsLoading(true);
        try {
          // Get auth token
          const { auth } = await import('@/lib/firebase');
          const { getIdToken } = await import('firebase/auth');
          const idToken = auth?.currentUser ? await getIdToken(auth.currentUser) : null;

          if (!idToken) {
            console.error('No auth token available');
            setIsLoading(false);
            return;
          }

          // Fetch PayPal URL from API
          const response = await fetch(`/api/paypal/get-button-url?userId=${user.id}`, {
            headers: {
              'Authorization': `Bearer ${idToken}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            setPaypalUrl(data.url);
          } else {
            console.error('Failed to get PayPal URL:', await response.text());
          }
        } catch (error) {
          console.error('Error fetching PayPal URL:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchPayPalUrl();
  }, [isOpen, user?.id]);

  if (!isOpen) return null;

  const tier = paymentTiers[0]; // Only weekly plan

  const handlePayPalClick = () => {
    if (paypalUrl && user?.id) {
      // Open PayPal in new window
      window.open(paypalUrl, '_blank');
      onClose();
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
            <button
              onClick={handlePayPalClick}
              disabled={isLoading || !paypalUrl}
              className="w-full bg-primary hover:bg-primary-dark disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Loading...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.243zm-.084-2.92l.793-5.12a.281.281 0 0 1 .278-.24h3.1c3.44 0 5.885-1.473 6.716-5.407.12-.62.18-1.216.18-1.78 0-1.543-.528-2.31-1.516-2.87-.74-.43-1.804-.64-3.23-.64H8.12c-.26 0-.48.19-.52.45l-1.584 10.2z"/>
                  </svg>
                  Subscribe with PayPal
                </>
              )}
            </button>
          ) : (
            <p className="text-center text-gray-400 text-sm">Please sign in to upgrade</p>
          )}
        </div>
      </div>
    </div>
  );
}



