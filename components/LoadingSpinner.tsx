'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export default function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className={`${sizeClasses[size]} animate-spin rounded-full border-t-2 border-b-2 border-primary`}></div>
      {text && <p className="text-sm text-gray-400">{text}</p>}
    </div>
  );
}



