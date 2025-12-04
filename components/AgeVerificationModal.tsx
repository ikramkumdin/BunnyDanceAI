'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useStore } from '@/store/useStore';

interface AgeVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (verified: boolean) => void;
}

export default function AgeVerificationModal({ 
  isOpen, 
  onClose, 
  onVerify 
}: AgeVerificationModalProps) {
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  if (!isOpen) return null;

  const handleVerify = () => {
    if (ageConfirmed) {
      useStore.getState().setAgeVerified(true);
      onVerify(true);
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
        
        <h2 className="text-2xl font-bold mb-4">Age Verification</h2>
        <p className="text-gray-300 mb-6">
          This content is restricted to users who are 18 years of age or older.
        </p>
        
        <div className="mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="w-5 h-5 rounded border-gray-600 text-primary focus:ring-primary"
            />
            <span className="text-gray-300">
              I confirm that I am 18 years of age or older
            </span>
          </label>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleVerify}
            disabled={!ageConfirmed}
            className="flex-1 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enter
          </button>
        </div>
      </div>
    </div>
  );
}



