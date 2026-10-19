'use client';

import { User } from '@/types';
import { Sparkles, Zap } from 'lucide-react';

interface CreditsDisplayProps {
  user: User | null;
  onUpgrade: () => void;
}

// v6 unified credit pool: show one balance (sub + payg + legacy pools),
// with a smaller breakdown of PAYG only when the user has some.
export default function CreditsDisplay({ user, onUpgrade }: CreditsDisplayProps) {
  if (!user) return null;

  const subscriptionCredits = user.credits ?? 0;
  const paygCredits = user.paygCredits ?? 0;
  // Legacy pools (pre-backfill) still count toward spendable total
  const legacy = (user.imageCredits ?? 0) + (user.videoCredits ?? 0);
  const total = subscriptionCredits + paygCredits + legacy;

  const showUpgrade = total <= 10;

  return (
    <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/30 rounded-lg p-4 shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h3 className="text-white font-bold text-sm uppercase tracking-wide">
              {user.tier === 'free' ? 'Free Credits' : `${user.tier.charAt(0).toUpperCase() + user.tier.slice(1)} Plan`}
            </h3>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300">Credits remaining:</span>
              <span className={`font-bold ${total > 10 ? 'text-green-400' : total > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                {total.toLocaleString()}
              </span>
            </div>
            {paygCredits > 0 && subscriptionCredits > 0 && (
              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span>of which top-up (never expires):</span>
                <span className="font-medium text-blue-300">{paygCredits.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {showUpgrade ? (
          <button
            onClick={onUpgrade}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all transform hover:scale-105 flex items-center gap-2 shadow-lg"
          >
            <Sparkles className="w-4 h-4" />
            Upgrade
          </button>
        ) : (
          <button
            onClick={onUpgrade}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-semibold text-xs transition-colors border border-white/20"
          >
            Get More
          </button>
        )}
      </div>

      {total === 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-xs text-yellow-300 flex items-center gap-2">
            <Sparkles className="w-3 h-3" />
            You&apos;ve used all your credits. Upgrade to continue!
          </p>
        </div>
      )}
    </div>
  );
}
