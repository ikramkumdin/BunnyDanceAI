'use client';

import { useRouter } from 'next/navigation';
import { Camera } from 'lucide-react';

export default function HeroSection() {
  const router = useRouter();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 flex items-center justify-between">
      <div className="flex-1">
        <h2 className="text-2xl font-bold mb-4">START CREATING</h2>
        <button
          onClick={() => router.push('/generate')}
          className="bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded-lg font-semibold text-lg flex items-center gap-3 transition-colors"
        >
          <Camera className="w-6 h-6" />
          Animate a Photo
        </button>
      </div>
      <div className="w-32 h-32 bg-slate-800 rounded-lg ml-6 flex items-center justify-center border border-slate-700">
        <Camera className="w-12 h-12 text-gray-500" />
      </div>
    </div>
  );
}

