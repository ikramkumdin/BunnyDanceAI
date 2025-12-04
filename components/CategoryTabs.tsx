'use client';

import { useState } from 'react';
import { TemplateCategory } from '@/types';

const categories: { label: string; value: TemplateCategory }[] = [
  { label: 'All', value: 'all' },
  { label: 'For You', value: 'for-you' },
  { label: 'Sway', value: 'sway' },
  { label: 'Shimmy', value: 'shimmy' },
  { label: 'Peach', value: 'peach' },
  { label: 'Halloween', value: 'halloween' },
  { label: 'Playful', value: 'playful' },
  { label: 'Fright Zone', value: 'fright-zone' },
];

const trendingCategories = [
  { label: 'TRENDING', value: 'trending' },
  { label: 'MY EFFECT', value: 'my-effect' },
];

export default function CategoryTabs() {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('all');
  const [selectedTrending, setSelectedTrending] = useState('trending');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        {trendingCategories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setSelectedTrending(cat.value)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              selectedTrending === cat.value
                ? 'text-primary'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      
      <div className="flex gap-2 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={`px-4 py-2 rounded-full transition-colors ${
              selectedCategory === cat.value
                ? 'bg-white text-gray-900 font-semibold'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}



