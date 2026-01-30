'use client';

import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { paymentTiers, PaymentTier } from '@/lib/payment';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTier: (tier: PaymentTier) => void;
}

export default function PaymentModal({ isOpen, onClose, onSelectTier }: PaymentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-2xl font-bold mb-2">Upgrade Your Plan</h2>
        <p className="text-gray-400 text-sm mb-6">Choose a plan to continue generating amazing content</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {paymentTiers.map((tier) => {
            const isPopular = tier.id === 'pro-monthly';
            const isBestValue = tier.id === 'starter-pack';
            return (
            <div
              key={tier.id}
              className={`bg-gray-700 rounded-lg p-6 border-2 transition-colors cursor-pointer relative ${
                isPopular ? 'border-primary ring-2 ring-primary/50' : 
                isBestValue ? 'border-green-500 ring-2 ring-green-500/50' : 
                'border-gray-600 hover:border-primary'
              }`}
              onClick={() => onSelectTier(tier)}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
                  MOST POPULAR
                </div>
              )}
              {isBestValue && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  BEST FOR STARTERS
                </div>
              )}
              <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold">${tier.price}</span>
                {tier.type === 'monthly' && (
                  <span className="text-gray-400">/month</span>
                )}
              </div>
              <ul className="space-y-2">
                {tier.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button className="w-full mt-4 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-semibold transition-colors">
                Select Plan
              </button>
            </div>
          )}
          )}
        </div>
      </div>
    </div>
  );
}



