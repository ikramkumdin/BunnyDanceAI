'use client';

import { Sparkles } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export default function Logo({ size = 'md', showText = true }: LogoProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeClasses[size]} bg-primary rounded-full flex items-center justify-center`}>
        <Sparkles className={`${sizeClasses[size]} text-white p-1.5`} />
      </div>
      {showText && (
        <span className={`${textSizes[size]} font-bold text-white`}>
          WaifuDance AI
        </span>
      )}
    </div>
  );
}

