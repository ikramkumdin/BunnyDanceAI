'use client';

import { useState } from 'react';
import { IntensityLevel } from '@/types';
import { useStore } from '@/store/useStore';

interface IntensitySliderProps {
  onIntensityChange: (intensity: IntensityLevel) => void;
}

export default function IntensitySlider({ onIntensityChange }: IntensitySliderProps) {
  const { user } = useStore();
  const [intensity, setIntensity] = useState<IntensityLevel>('mild');

  const intensities: { value: IntensityLevel; label: string; color: string }[] = [
    { value: 'mild', label: 'Mild', color: 'bg-green-500' },
    { value: 'spicy', label: 'Spicy', color: 'bg-yellow-500' },
    { value: 'extreme', label: 'Extreme', color: 'bg-red-500' },
  ];

  const handleIntensityChange = (newIntensity: IntensityLevel) => {
    if (newIntensity === 'extreme' && user?.tier === 'free') {
      // Show upgrade prompt or charge credits
      return;
    }
    setIntensity(newIntensity);
    onIntensityChange(newIntensity);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-semibold text-gray-300">Intensity</label>
        <span className="text-xs text-gray-500">(Controls dance movement intensity)</span>
      </div>
      <div className="flex gap-2">
        {intensities.map((item) => (
          <button
            key={item.value}
            onClick={() => handleIntensityChange(item.value)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              intensity === item.value
                ? `${item.color} text-white font-semibold`
                : 'bg-gray-700 text-gray-400 hover:text-white'
            }`}
            title={
              item.value === 'mild' 
                ? 'Subtle, elegant movements' 
                : item.value === 'spicy' 
                ? 'Moderate, energetic movements' 
                : 'Intense, extreme movements'
            }
          >
            {item.label}
          </button>
        ))}
      </div>
      {intensity === 'extreme' && user?.tier === 'free' && (
        <p className="text-xs text-yellow-500">
          Extreme intensity requires Pro subscription or credits
        </p>
      )}
    </div>
  );
}

