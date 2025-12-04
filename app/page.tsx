'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { templates } from '@/data/templates';
import { Template, TemplateCategory } from '@/types';
import { Camera } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('all');
  const [activeTab, setActiveTab] = useState<'trending' | 'my-effect'>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [templateVideoUrls, setTemplateVideoUrls] = useState<Record<string, string>>({});

  // Fetch signed URLs for template videos
  useEffect(() => {
    const fetchSignedUrls = async () => {
      const urls: Record<string, string> = {};
      for (const template of templates) {
        if (template.previewVideo) {
          try {
            const signedResponse = await fetch(`/api/get-signed-url?path=${encodeURIComponent(template.previewVideo)}`);
            if (signedResponse.ok) {
              const data = await signedResponse.json();
              urls[template.id] = data.url;
            } else {
              urls[template.id] = template.previewVideo;
            }
          } catch (error) {
            urls[template.id] = template.previewVideo;
          }
        }
      }
      setTemplateVideoUrls(urls);
    };

    if (templates.length > 0) {
      fetchSignedUrls();
    }
  }, [templates.length]);

  const filteredTemplates = templates.filter((template) => {
    // Filter out hidden templates
    if (template.isHidden) return false;

    // Filter by category (if not 'all')
    if (selectedCategory && selectedCategory !== 'all') {
      if (template.category !== selectedCategory) return false;
    }

    // Filter by search query
    if (searchQuery) {
      const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           template.description.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
    }
    return true;
  });

  // Get "Top Choice" templates (you can customize this logic)
  const topChoiceTemplates = filteredTemplates.slice(0, 5);

  const handleAnimatePhoto = () => {
    router.push('/generate');
  };

  const handleTemplateClick = (template: Template) => {
    router.push(`/generate?template=${template.id}`);
  };

  return (
    <Layout onSearch={(query) => setSearchQuery(query)}>
      <div className="flex flex-col gap-6 p-6">
        {/* START CREATING Section */}
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold text-white">START CREATING</h2>
          <button
            onClick={handleAnimatePhoto}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg transition-colors font-semibold w-fit"
          >
            <Camera className="w-5 h-5" />
            <span>Animate a Photo</span>
          </button>
        </div>

        {/* TRENDING / MY EFFECT Tabs */}
        <div className="flex gap-4 border-b border-gray-800 pb-2">
          <button
            onClick={() => setActiveTab('trending')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'trending'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            TRENDING
          </button>
          <button
            onClick={() => setActiveTab('my-effect')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'my-effect'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            MY EFFECT
          </button>
        </div>

        {/* Category Filter Buttons */}
        <div className="flex gap-2 flex-wrap">
          {[
            { label: 'All', value: 'all' as TemplateCategory },
            { label: 'For You', value: 'for-you' as TemplateCategory },
            { label: 'Sway', value: 'sway' as TemplateCategory },
            { label: 'Shimmy', value: 'shimmy' as TemplateCategory },
            { label: 'Peach', value: 'peach' as TemplateCategory },
            { label: 'Halloween', value: 'halloween' as TemplateCategory },
            { label: 'Playful', value: 'playful' as TemplateCategory },
            { label: 'Fright Zone', value: 'fright-zone' as TemplateCategory },
          ].map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-4 py-2 rounded-full transition-colors text-sm ${
                selectedCategory === cat.value
                  ? 'bg-primary text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Template Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredTemplates.map((template) => {
            const isTopChoice = topChoiceTemplates.includes(template);
            return (
              <div
                key={template.id}
                onClick={() => handleTemplateClick(template)}
                className="relative aspect-[9/16] bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform group"
              >
                {template.previewVideo ? (
                  <video
                    key={template.id}
                    src={templateVideoUrls[template.id] || template.previewVideo}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    onMouseEnter={(e) => {
                      e.currentTarget.play().catch(err => console.log('Play failed:', err));
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.pause();
                      e.currentTarget.currentTime = 0;
                    }}
                    onError={(e) => {
                      console.error('Video failed to load:', template.id, e.currentTarget.src);
                      // Try fallback to original URL if signed URL fails
                      if (templateVideoUrls[template.id] && template.previewVideo && e.currentTarget.src !== template.previewVideo) {
                        e.currentTarget.src = template.previewVideo;
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                    <span className="text-gray-500 text-xs text-center px-2">
                      {template.name}
                    </span>
                  </div>
                )}
                
                {/* Top Choice Badge */}
                {isTopChoice && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <div className="text-primary text-xs font-semibold">Top Choice</div>
                    <div className="text-white text-sm font-bold">{template.name}</div>
                  </div>
                )}
                
                {/* Template Name Overlay (if not top choice) */}
                {!isTopChoice && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="text-white text-sm font-semibold">{template.name}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
