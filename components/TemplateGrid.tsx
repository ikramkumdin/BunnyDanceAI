'use client';

import { useState, useEffect } from 'react';
import { Template } from '@/types';
import { templates } from '@/data/templates';
import { useStore } from '@/store/useStore';
import { Lock, Star } from 'lucide-react';

interface TemplateGridProps {
  searchQuery?: string;
}

export default function TemplateGrid({ searchQuery = '' }: TemplateGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [videoUrls, setVideoUrls] = useState<{ [key: string]: string }>({});
  const { user } = useStore();

  // Get signed URLs for all template videos
  useEffect(() => {
    const fetchSignedUrls = async () => {
      const urls: { [key: string]: string } = {};
      for (const template of templates) {
        if (template.previewVideo) {
          try {
            // Get signed URL for the video (works for both public and private files)
            const signedResponse = await fetch(`/api/get-signed-url?path=${encodeURIComponent(template.previewVideo)}`);
            if (signedResponse.ok) {
              const data = await signedResponse.json();
              urls[template.id] = data.url;
            } else {
              // Fallback to direct URL if signed URL fails
              urls[template.id] = template.previewVideo;
            }
          } catch (error) {
            // Fallback to direct URL on error
            console.warn('Error getting signed URL for', template.id, 'using direct URL');
            urls[template.id] = template.previewVideo;
          }
        }
      }
      setVideoUrls(urls);
    };

    fetchSignedUrls();
  }, []);

  const filteredTemplates = templates.filter((template) => {
    // Filter by search query
    if (searchQuery) {
      const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           template.description.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
    }
    
    // Filter by category
    if (selectedCategory === 'all') return true;
    if (template.isHidden && user?.tier === 'free') return false;
    return template.category === selectedCategory;
  });

  const canAccess = (template: Template) => {
    if (!template.isPremium) return true;
    if (template.isHidden && user?.tier === 'free') return false;
    if (user?.tier === 'starter' || user?.tier === 'standard' || user?.tier === 'pro') return true;
    return user && user.credits >= (template.price || 0);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {filteredTemplates.map((template) => {
        const accessible = canAccess(template);
        
        return (
          <div
            key={template.id}
            className="relative aspect-[9/16] bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform group"
          >
            {template.previewVideo && videoUrls[template.id] ? (
              <video
                src={videoUrls[template.id]}
                className="w-full h-full object-cover"
                muted
                loop
                playsInline
                onMouseEnter={(e) => e.currentTarget.play()}
                onMouseLeave={(e) => {
                  e.currentTarget.pause();
                  e.currentTarget.currentTime = 0;
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                <span className="text-gray-500 text-sm">{template.name}</span>
              </div>
            )}
            
            {template.isPremium && (
              <div className="absolute top-2 left-2 bg-primary px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                <Star className="w-3 h-3" />
                {template.price ? `$${template.price}` : 'Premium'}
              </div>
            )}
            
            {!accessible && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <Lock className="w-8 h-8 text-white" />
              </div>
            )}
            
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-white text-sm font-semibold">{template.name}</p>
              <p className="text-gray-300 text-xs">{template.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

