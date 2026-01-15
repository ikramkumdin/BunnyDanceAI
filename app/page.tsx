'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { templates } from '@/data/templates';
import { Template, TemplateCategory } from '@/types';
import { Camera, ChevronDown, Download, Loader2, Play, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Layout from '@/components/Layout';
import { useStore } from '@/store/useStore';

import { beautyPrompts } from '@/data/beauty-prompts';

export default function Home() {
  const router = useRouter();
  const setStoreUploadedImage = useStore((state) => state.setUploadedImage);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('all');
  const [activeTab, setActiveTab] = useState<'trending' | 'my-effect'>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [videoUrls, setVideoUrls] = useState<{ [key: string]: string }>({});

  // Random Beauty Generator State
  const [isGeneratingRandom, setIsGeneratingRandom] = useState(false);
  const [randomImageUrl, setRandomImageUrl] = useState<string | null>(null);
  const [randomError, setRandomError] = useState<string | null>(null);
  const activeRandomTaskId = useRef<string | null>(null);

  const handleRandomGenerate = async () => {
    setIsGeneratingRandom(true);
    setRandomError(null);
    setRandomImageUrl(null);

    try {
      const randomPrompt = beautyPrompts[Math.floor(Math.random() * beautyPrompts.length)];

      const response = await fetch('/api/generate-text-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: randomPrompt }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to start generation');

      const taskId = data.taskId;
      activeRandomTaskId.current = taskId;

      // Polling for image status
      let attempts = 0;
      const maxAttempts = 100; // Increased to ~8 minutes total
      const pollInterval = 5000; // 5 seconds

      const poll = async () => {
        // Stop if task ID changed or generation was cancelled
        if (activeRandomTaskId.current !== taskId) return;

        if (attempts >= maxAttempts) {
          setIsGeneratingRandom(false);
          activeRandomTaskId.current = null;
          setRandomError('Generation is taking a while. Please try again or check back later.');
          return;
        }

        try {
          const pollResp = await fetch(`/api/poll-image-task?taskId=${taskId}&provider=kie`);
          const pollData = await pollResp.json();

          // Double check task ID after fetch
          if (activeRandomTaskId.current !== taskId) return;

          if (pollData.status === 'COMPLETED' || (pollData.status === 'SUCCESS') || (pollData.source === 'cache' && pollData.imageUrl)) {
            setRandomImageUrl(pollData.imageUrl);
            setIsGeneratingRandom(false);
            activeRandomTaskId.current = null;
          } else if (pollData.status === 'FAILED') {
            throw new Error(pollData.error || 'Generation failed');
          } else {
            attempts++;
            setTimeout(poll, pollInterval);
          }
        } catch (err) {
          if (activeRandomTaskId.current === taskId) {
            setIsGeneratingRandom(false);
            activeRandomTaskId.current = null;
            setRandomError(err instanceof Error ? err.message : 'Polling failed');
          }
        }
      };

      poll();
    } catch (err) {
      setIsGeneratingRandom(false);
      activeRandomTaskId.current = null;
      setRandomError(err instanceof Error ? err.message : 'Failed to generate image');
    }
  };

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `bunny-dance-beauty-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed:', err);
      window.open(url, '_blank');
    }
  };

  const handleUseForVideo = (url: string) => {
    setStoreUploadedImage(url);
    router.push('/generate');
  };

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

  const topChoiceTemplates = filteredTemplates.slice(0, 5);

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

  const handleAnimatePhoto = () => {
    router.push('/generate');
  };

  const handleTemplateClick = (template: Template) => {
    router.push(`/generate?template=${template.id}`);
  };

  return (
    <Layout onSearch={(query) => setSearchQuery(query)}>
      <div className="flex flex-col gap-12 p-6 max-w-7xl mx-auto">
        {/* HERO Section */}
        <section className="flex flex-col gap-6 text-center py-12 border-b border-gray-800">
          <h1 className="text-4xl md:text-6xl font-bold text-white bg-gradient-to-r from-primary via-purple-400 to-accent bg-clip-text text-transparent">
            BunnyDance AI: Instant AI Dance Video Generator
          </h1>
          <p className="text-gray-300 text-lg md:text-xl max-w-4xl mx-auto leading-relaxed">
            Upload any photo—real or anime—and create short sensual dance videos with effects like twerking, hip shaking, and pole dancing.
            For creators on TikTok, OnlyFans, or Tinder: Generate viral-ready content in seconds.
            For anime fans: Turn your waifu into a private dance fantasy collection.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-4">
            <button
              onClick={handleAnimatePhoto}
              className="flex items-center gap-3 bg-primary hover:bg-primary-dark text-white px-10 py-5 rounded-full transition-all hover:scale-105 font-bold shadow-xl shadow-primary/25 text-lg w-full sm:w-auto justify-center"
            >
              <Camera className="w-6 h-6" />
              <span>Upload Photo Now</span>
            </button>
            <button
              onClick={handleRandomGenerate}
              disabled={isGeneratingRandom}
              className="flex items-center gap-3 bg-gray-900 border border-gray-700 hover:border-primary/50 text-white px-10 py-5 rounded-full transition-all hover:scale-105 font-bold shadow-xl text-lg disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
            >
              {isGeneratingRandom ? (
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              ) : (
                <Sparkles className="w-6 h-6 text-primary" />
              )}
              <span>Random Beauty Picture</span>
            </button>
          </div>

          {/* Randomly Generated Image Result */}
          {(randomImageUrl || isGeneratingRandom || randomError) && (
            <div className="mt-8 flex flex-col items-center">
              <div className="relative aspect-[2/3] w-64 md:w-80 bg-gray-900 rounded-2xl overflow-hidden border-2 border-dashed border-gray-800 flex items-center justify-center group shadow-2xl">
                {isGeneratingRandom && (
                  <div className="flex flex-col items-center gap-3 p-4 text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-gray-400 font-medium">Creating masterpiece...</p>
                    <p className="text-gray-500 text-xs px-4">Kie.ai is processing your unique beauty request. This usually takes 30-60 seconds.</p>
                  </div>
                )}
                {randomError && (
                  <div className="p-6 text-center">
                    <p className="text-red-400 mb-2 font-semibold">Error</p>
                    <p className="text-gray-500 text-sm">{randomError}</p>
                    <button onClick={handleRandomGenerate} className="mt-4 text-primary font-bold hover:underline">Try Again</button>
                  </div>
                )}
                {randomImageUrl && (
                  <>
                    <Image
                      src={randomImageUrl}
                      alt="Random beauty"
                      fill
                      sizes="(max-width: 768px) 100vw, 400px"
                      className="object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4 backdrop-blur-sm">
                      <button
                        onClick={() => handleUseForVideo(randomImageUrl)}
                        className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-full flex items-center gap-2 font-bold shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all duration-300"
                      >
                        <Play className="w-5 h-5 fill-current" />
                        Use for Video
                      </button>
                      <button
                        onClick={() => handleDownload(randomImageUrl)}
                        className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-full flex items-center gap-2 font-bold border border-white/20 transform translate-y-4 group-hover:translate-y-2 transition-all duration-300"
                      >
                        <Download className="w-5 h-5" />
                        Download
                      </button>
                    </div>
                  </>
                )}
              </div>
              {randomImageUrl && !isGeneratingRandom && (
                <p className="mt-4 text-gray-400 text-sm animate-pulse flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Like it? Use it for your next dance video!
                </p>
              )}
            </div>
          )}
        </section>

        {/* TRENDING EFFECTS Header */}
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold text-white">Trending Sensual Dance Effects</h2>
          <p className="text-gray-400 text-lg">Select a trending effect to create your viral dance animation.</p>
        </div>

        {/* Featured Effects Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            templates.find(t => t.id === 'lustful-touch'),
            templates.find(t => t.id === 'twerk-girl'),
            templates.find(t => t.id === 'kneel-and-crawl')
          ].filter(Boolean).map((template) => (
            <div
              key={template!.id}
              onClick={() => handleTemplateClick(template!)}
              onMouseEnter={(e) => {
                const video = e.currentTarget.querySelector('video');
                if (video) video.play().catch(err => console.log('Play failed:', err));
              }}
              onMouseLeave={(e) => {
                const video = e.currentTarget.querySelector('video');
                if (video) {
                  video.pause();
                  video.currentTime = 0;
                }
              }}
              className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden group hover:border-primary/50 transition-all cursor-pointer"
            >
              <div className="relative aspect-video">
                {template!.previewVideo ? (
                  <video
                    src={videoUrls[template!.id] || template!.previewVideo}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <span className="text-gray-500">Preview Coming Soon</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                <div className="absolute top-3 right-3 bg-primary/90 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                  HOT
                </div>
              </div>
              <div className="p-6 flex flex-col gap-3">
                <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors flex items-center gap-2">
                  {template!.name}
                  <Sparkles className="w-4 h-4 text-primary" />
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed line-clamp-2">
                  {template!.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* TRENDING / MY EFFECT Tabs */}
        <div className="flex gap-4 border-b border-gray-800 pb-2">
          <button
            onClick={() => setActiveTab('trending')}
            className={`px-4 py-2 font-semibold transition-colors ${activeTab === 'trending'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-400 hover:text-white'
              }`}
          >
            TRENDING
          </button>
          <button
            onClick={() => setActiveTab('my-effect')}
            className={`px-4 py-2 font-semibold transition-colors ${activeTab === 'my-effect'
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
              className={`px-4 py-2 rounded-full transition-colors text-sm ${selectedCategory === cat.value
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
                onMouseEnter={(e) => {
                  const video = e.currentTarget.querySelector('video');
                  if (video) video.play().catch(err => console.log('Play failed:', err));
                }}
                onMouseLeave={(e) => {
                  const video = e.currentTarget.querySelector('video');
                  if (video) {
                    video.pause();
                    video.currentTime = 0;
                  }
                }}
                className="relative aspect-[9/16] bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform group"
              >
                {template.previewVideo && videoUrls[template.id] ? (
                  <video
                    key={template.id}
                    src={videoUrls[template.id]}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    onError={(e) => {
                      console.error('Video failed to load:', template.id, e.currentTarget.src);
                      // Try fallback to original URL if signed URL fails
                      if (template.previewVideo && e.currentTarget.src !== template.previewVideo) {
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

        {/* Audience-Specific Sections */}
        <div className="grid md:grid-cols-2 gap-8 py-12 border-t border-gray-800">
          <section className="bg-gray-900/40 p-10 rounded-3xl border border-gray-800/50 backdrop-blur-sm">
            <h2 className="text-3xl font-bold text-primary mb-6">For Creators: Fast Viral Content</h2>
            <ul className="space-y-4 text-gray-300 text-lg">
              <li className="flex gap-4 items-start">
                <span className="text-primary text-xl">✨</span>
                <span>Generate TikTok-ready twerk and pole dance videos from selfies in seconds.</span>
              </li>
              <li className="flex gap-4 items-start">
                <span className="text-primary text-xl">✨</span>
                <span>Enhance OnlyFans with sensual animations—boost engagement and retention 2x.</span>
              </li>
              <li className="flex gap-4 items-start">
                <span className="text-primary text-xl">✨</span>
                <span>Easy sharing to Instagram or Tinder for profile pops that stand out.</span>
              </li>
            </ul>
          </section>

          <section className="bg-gray-900/40 p-10 rounded-3xl border border-gray-800/50 backdrop-blur-sm">
            <h2 className="text-3xl font-bold text-purple-400 mb-6">For Anime Fans: Private Waifu Fantasies</h2>
            <p className="text-gray-300 text-lg leading-relaxed">
              Animate your favorite anime characters with alluring hip shaking or lustful touches.
              Our AI is specifically optimized for anime styles, ensuring your waifu transitions from static art to immersive, high-quality dance animations.
              Build your private collection of sensual fantasies discreetly and instantly.
            </p>
          </section>
        </div>

        {/* FAQ Section */}
        <section className="flex flex-col gap-8 py-12 border-t border-gray-800">
          <h2 className="text-4xl font-bold text-white text-center">FAQs: AI Sensual Dance Video Creation</h2>
          <div className="grid gap-6 max-w-4xl mx-auto w-full">
            <details className="group bg-gray-900/50 rounded-2xl border border-gray-800 p-6 cursor-pointer hover:border-primary/50 transition-colors">
              <summary className="flex justify-between items-center text-xl font-bold text-white list-none">
                How to create twerk videos for OnlyFans?
                <ChevronDown className="w-6 h-6 group-open:rotate-180 transition-transform text-primary" />
              </summary>
              <div className="mt-6 text-gray-400 text-lg leading-relaxed">
                Simply upload your photo, select the &apos;Twerk Girl&apos; effect from our trending library, and hit generate.
                Our AI handles the professional-grade animation, delivering a viral-ready video that&apos;s perfect for OnlyFans, TikTok, or Instagram.
              </div>
            </details>

            <details className="group bg-gray-900/50 rounded-2xl border border-gray-800 p-6 cursor-pointer hover:border-primary/50 transition-colors">
              <summary className="flex justify-between items-center text-xl font-bold text-white list-none">
                Can I animate anime waifus?
                <ChevronDown className="w-6 h-6 group-open:rotate-180 transition-transform text-purple-400" />
              </summary>
              <div className="mt-6 text-gray-400 text-lg leading-relaxed">
                Yes! BunnyDance AI is designed to support both real-life photography and diverse anime styles.
                Whether it&apos;s a fan-art piece or an official character shot, our AI accurately captures the aesthetic and transforms it into a fluid hip-shake or dance fantasy.
              </div>
            </details>

            <details className="group bg-gray-900/50 rounded-2xl border border-gray-800 p-6 cursor-pointer hover:border-primary/50 transition-colors">
              <summary className="flex justify-between items-center text-xl font-bold text-white list-none">
                How long does it take to generate a video?
                <ChevronDown className="w-6 h-6 group-open:rotate-180 transition-transform text-accent" />
              </summary>
              <div className="mt-6 text-gray-400 text-lg leading-relaxed">
                Most sensual dance videos are generated in under 30 seconds. We prioritize both speed and quality so you can create content at the pace of your creativity.
              </div>
            </details>
          </div>
        </section>
      </div>
    </Layout>
  );
}
