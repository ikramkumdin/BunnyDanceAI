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
        
        <h2 className="text-2xl font-bold mb-6">Upgrade Your Plan</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paymentTiers.map((tier) => (
            <div
              key={tier.id}
              className="bg-gray-700 rounded-lg p-6 border-2 border-gray-600 hover:border-primary transition-colors cursor-pointer"
              onClick={() => onSelectTier(tier)}
            >
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
          ))}
        </div>
      </div>
    </div>
  );
}



