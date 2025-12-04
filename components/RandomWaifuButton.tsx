'use client';

import { Sparkles } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { templates } from '@/data/templates';
import { Template } from '@/types';

interface RandomWaifuButtonProps {
  onTemplateSelect: (template: Template) => void;
  disabled?: boolean;
}

export default function RandomWaifuButton({ onTemplateSelect, disabled }: RandomWaifuButtonProps) {
  const { uploadedImage } = useStore();

  const handleRandomWaifu = () => {
    if (!uploadedImage) {
      alert('Please upload a photo first');
      return;
    }

    // Select random extreme template (anime-focused)
    const animeTemplates = templates.filter(
      (t) => (t.category === 'bunny-girl' || t.category === 'jk' || t.category === 'catgirl') && t.intensity === 'extreme'
    );
    
    // Fallback to any extreme template if no anime ones
    const extremeTemplates = animeTemplates.length > 0 
      ? animeTemplates 
      : templates.filter((t) => t.intensity === 'extreme');
    
    if (extremeTemplates.length === 0) {
      alert('No extreme templates available');
      return;
    }

    const randomTemplate = extremeTemplates[Math.floor(Math.random() * extremeTemplates.length)];
    onTemplateSelect(randomTemplate);
  };

  return (
    <button
      onClick={handleRandomWaifu}
      disabled={disabled || !uploadedImage}
      className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <Sparkles className="w-5 h-5" />
      Random Waifu Dance
    </button>
  );
}

