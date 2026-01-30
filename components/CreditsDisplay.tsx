'use client';

import { User } from '@/types';
import { Sparkles, Zap } from 'lucide-react';

interface CreditsDisplayProps {
  user: User | null;
  onUpgrade: () => void;
}

export default function CreditsDisplay({ user, onUpgrade }: CreditsDisplayProps) {
  if (!user) return null;

  // Pro and lifetime users have unlimited
  const isUnlimited = user.tier === 'pro' || user.tier === 'lifetime';
  
  const imageCredits = user.imageCredits || 0;
  const videoCredits = user.videoCredits || 0;
  const totalCredits = imageCredits + videoCredits;
  
  // Show upgrade prompt if credits are low or out
  const showUpgrade = !isUnlimited && totalCredits <= 1;

  return (
    <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/30 rounded-lg p-4 shadow-lg">
      <div className="flex items-center justify-between gap-4">
        {/* Credits Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h3 className="text-white font-bold text-sm uppercase tracking-wide">
              {isUnlimited ? 'Unlimited Access' : 'Free Credits'}
            </h3>
          </div>
          
          {!isUnlimited ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300">Images:</span>
                <span className={`font-bold ${imageCredits > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {imageCredits} / 3 remaining
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300">Videos:</span>
                <span className={`font-bold ${videoCredits > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {videoCredits} / 3 remaining
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-300">
              Generate unlimited images & videos
            </p>
          )}
        </div>

        {/* Upgrade Button */}
        {showUpgrade && (
          <button
            onClick={onUpgrade}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all transform hover:scale-105 flex items-center gap-2 shadow-lg"
          >
            <Sparkles className="w-4 h-4" />
            Upgrade
          </button>
        )}
        
        {!showUpgrade && !isUnlimited && totalCredits > 1 && (
          <button
            onClick={onUpgrade}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-semibold text-xs transition-colors border border-white/20"
          >
            Get More
          </button>
        )}
      </div>

      {/* Warning if credits are low */}
      {!isUnlimited && totalCredits === 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-xs text-yellow-300 flex items-center gap-2">
            <Sparkles className="w-3 h-3" />
            You&apos;ve used all your free credits. Upgrade to continue!
          </p>
        </div>
      )}
    </div>
  );
}
