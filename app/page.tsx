'use client';

import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import PhotoUpload from '@/components/PhotoUpload';
import AgeVerificationModal from '@/components/AgeVerificationModal';
import FullScreenVideoModal from '@/components/FullScreenVideoModal';
import { templates } from '@/data/templates';
import { useStore } from '@/store/useStore';
import { Template } from '@/types';
import { Sparkles, RotateCcw, Save, Heart, Download, Search, X } from 'lucide-react';
import RandomWaifuButton from '@/components/RandomWaifuButton';
import { useUser } from '@/hooks/useUser';

export default function Home() {
  const { user, isLoading: userLoading } = useUser();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const { uploadedImage, isAgeVerified, setSelectedTemplate: setStoreTemplate, setUploadedImage } = useStore();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isAgeVerified) {
      setShowAgeModal(true);
    }
  }, [isAgeVerified]);

  // Debug: Track isGenerating state changes
  useEffect(() => {
    console.log('🔄 isGenerating changed to:', isGenerating);
  }, [isGenerating]);

  // Keep image URL in sync with store and try to get signed URL if needed
  useEffect(() => {
    if (uploadedImage) {
      // If it's a GCP URL, try to get signed URL immediately
      if (uploadedImage.startsWith('https://storage.googleapis.com/')) {
        // First set the direct URL
        setImageUrl(uploadedImage);
        // Then try to get signed URL in background (for private files)
        fetch(`/api/get-signed-url?path=${encodeURIComponent(uploadedImage)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.url) {
              setImageUrl(data.url);
            }
          })
          .catch((err) => {
            console.warn('Could not get signed URL, using direct URL:', err);
            // Keep the direct URL if signed URL fails
          });
      } else {
        // Base64 or other URL, use directly
        setImageUrl(uploadedImage);
      }
    } else {
      setImageUrl(null);
    }
  }, [uploadedImage]);

  const handleImageSelect = (imageUrl: string) => {
    // Image is handled by PhotoUpload component
  };

  const handleTemplateSelect = async (template: Template) => {
    console.log('Template selected:', template.name);
    if (template.isPremium && user?.tier === 'free' && !user.credits) {
      // Show payment modal
      console.log('Premium template - need to show payment modal');
      return;
    }
    setSelectedTemplate(template);
    setStoreTemplate(template);
    setGeneratedVideo(null); // Reset video when new template is selected

    // Auto-generate only if image is uploaded
    if (uploadedImage && user) {
      console.log('Auto-generating with image and user present');
      // Wait a moment for state to update, then generate
      setTimeout(() => {
        handleGenerate();
      }, 100);
    } else {
      console.log('Template selected - waiting for image upload to generate');
    }
  };

  // Poll our own database to check if video is ready (callback has saved it)
  const pollVideoStatus = async (startTime: number = Date.now(), currentTaskId?: string) => {
    const maxWaitTime = 900000; // 15 minutes max (increased)
    const pollInterval = 15000; // Poll every 15 seconds (less frequent)

    const poll = async (): Promise<void> => {
      try {
        if (!user) {
          console.log('❌ Polling stopped - no user');
          setIsGenerating(false);
          return;
        }

        // Use the passed taskId or get it from state if available
        const taskIdToUse = currentTaskId || taskId || '';
        const pollUrl = `/api/check-video?userId=${user.id}&taskId=${taskIdToUse}`;
        console.log('🔍 Polling for video:', pollUrl);
        console.log('📋 Using taskId:', taskIdToUse);
        const response = await fetch(pollUrl);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to check video status');
        }

        const data = await response.json();
        console.log('📹 Poll response:', data);

        // Check if video is ready
        if (data.ready && data.videoUrl) {
          console.log('✅ Video ready!', data.videoUrl);

          // Get signed URL if it's a GCP URL
          let finalVideoUrl = data.videoUrl;
          if (data.videoUrl.startsWith('https://storage.googleapis.com/')) {
            try {
              const signedResponse = await fetch(`/api/get-signed-url?path=${encodeURIComponent(data.videoUrl)}`);
              if (signedResponse.ok) {
                const signedData = await signedResponse.json();
                if (signedData.url) {
                  finalVideoUrl = signedData.url;
                  console.log('📝 Got signed URL for video');
                }
              }
            } catch (err) {
              console.warn('Could not get signed URL for video, using direct URL:', err);
            }
          }

          setGeneratedVideo(finalVideoUrl);
          setIsGenerating(false);
          setCountdown(null);
          setTaskId(null);
          return;
        }

        // Check if we've been waiting too long
        if (Date.now() - startTime > maxWaitTime) {
          throw new Error('Video generation timed out. The video may still be processing. Please check back later.');
        }

        // Update countdown (estimate remaining time)
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setCountdown(Math.max(0, 900 - elapsed)); // Show countdown from 900 seconds (15 minutes)

        console.log(`⏳ Waiting... ${900 - elapsed}s remaining (Note: Callback URL not reachable locally, video generation may take 10-15 minutes)`);

        // Continue polling
        setTimeout(poll, pollInterval);
      } catch (error) {
        console.error('Polling error:', error);
        setIsGenerating(false);
        setCountdown(null);
        setTaskId(null);
        alert(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    poll();
  };

  const handleGenerate = async () => {
    const currentImage = uploadedImage;
    const currentTemplate = selectedTemplate;

    if (!currentImage || !currentTemplate || !user) {
      console.log('Cannot generate - missing:', { currentImage: !!currentImage, currentTemplate: !!currentTemplate, user: !!user });
      return;
    }

    console.log('🚀 Starting REAL video generation with your image...');
    console.log('🖼️ Image URL:', currentImage);
    console.log('📝 Template:', currentTemplate.name);

    setIsGenerating(true);
    setGeneratedVideo(null); // Clear previous video
    setCountdown(900); // Start countdown (15 minutes)
    setTaskId(null);
    console.log('State set: isGenerating=true, countdown=900');

    // Scroll to preview section
    setTimeout(() => {
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

    try {
      console.log('📡 Making API call to /api/generate...');
      const requestBody = {
        imageUrl: currentImage,
        templateId: currentTemplate.id,
        intensity: 'spicy', // Default intensity
        userId: user.id,
      };
      console.log('📋 Request body:', requestBody);

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 API response status:', response.status);

      const data = await response.json();

      if (!response.ok) {
        // Show detailed error message
        const errorMsg = data.error || 'Generation failed';
        const details = data.details ? `\n\nDetails: ${data.details}` : '';
        throw new Error(`${errorMsg}${details}`);
      }

      // Check if we got a taskId (async job - will use callback)
      if (data.taskId) {
        console.log('📋 Received taskId:', data.taskId);
        setTaskId(data.taskId);
        // Start polling our own database (callback will save the video)
        pollVideoStatus(Date.now(), data.taskId);
      } else if (data.videoUrl) {
        // Direct video URL (synchronous)
        setGeneratedVideo(data.videoUrl);
        setIsGenerating(false);
        setCountdown(null);
      } else {
        throw new Error('No video URL or taskId returned from server');
      }
    } catch (error) {
      console.error('Generation error:', error);
      setIsGenerating(false);
      setCountdown(null);
      setTaskId(null);

      let errorMessage = 'Failed to generate video. Please try again.';

      if (error instanceof Error) {
        errorMessage = error.message;
        // If it's a 404 error about Grok API, provide helpful message
        if (errorMessage.includes('404') || errorMessage.includes('not found')) {
          errorMessage = `API endpoint not found. Please check your GROK_API_URL in .env.local file.\n\n${errorMessage}`;
        }
      }

      alert(`Generation failed:\n\n${errorMessage}`);
    }
  };

  const handleRetry = () => {
    setGeneratedVideo(null);
    handleGenerate();
  };

  const handleSave = () => {
    if (!generatedVideo) return;
    setShowFullScreen(true);
  };

  const handleDownload = () => {
    if (!generatedVideo) return;
    const link = document.createElement('a');
    link.href = generatedVideo;
    link.download = `bunny-dance-${Date.now()}.mp4`;
    link.click();
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

  // Debug: Log filtered templates count
  useEffect(() => {
    console.log('=== TEMPLATE DEBUG ===');
    console.log('Total templates:', templates.length);
    console.log('Visible templates (not hidden):', templates.filter(t => !t.isHidden).length);
    console.log('Filtered templates:', filteredTemplates.length);
    console.log('Search query:', searchQuery || 'none');
    console.log('Selected category:', selectedCategory);
    console.log('Hidden templates:', templates.filter(t => t.isHidden).map(t => t.id));
    console.log('Custom templates:', templates.filter(t => t.category === 'custom').map(t => `${t.id} (${t.isHidden ? 'hidden' : 'visible'})`));
    console.log('Template categories:', [...new Set(templates.map(t => t.category))]);
    console.log('====================');
  }, [templates.length, filteredTemplates.length, searchQuery, selectedCategory]);

  // Debug: Log when component mounts
  useEffect(() => {
    console.log('🎬 Component mounted, templates loaded:', templates.length);
    console.log('📋 Template categories:', [...new Set(templates.map(t => t.category))]);
    console.log('🔍 Custom templates found:', templates.filter(t => t.category === 'custom').length);
    console.log('📊 Templates by category:', templates.reduce((acc: Record<string, number>, t) => {
      acc[t.category] = (acc[t.category] || 0) + 1;
      return acc;
    }, {}));

    // Test video URL accessibility
    const testVideoUrl = 'https://storage.googleapis.com/voice-app-storage/templates/dance-template-1764872168595.mp4';
    console.log('🧪 Testing video URL:', testVideoUrl);

    fetch(testVideoUrl, { method: 'HEAD' })
      .then(response => {
        console.log('📹 Video URL status:', response.status, response.ok ? '✅ Accessible' : '❌ Not accessible');
        if (response.headers.get('content-type')) {
          console.log('📄 Content-Type:', response.headers.get('content-type'));
        }
      })
      .catch(error => {
        console.error('💥 Video URL test failed:', error);
      });
  }, []);

  // Debug: Log when component mounts
  useEffect(() => {
    console.log('🎬 Component mounted, templates loaded:', templates.length);
  }, []);

  return (
    <>
      <Layout onSearch={(query) => setSearchQuery(query)}>
        <div className="flex flex-col gap-4 p-6">
          {/* Upload Area - Same size as templates, above tags */}
          <div className="flex justify-center">
            <div className="relative aspect-[9/16] w-80 bg-gray-800 rounded-lg overflow-hidden">
              {uploadedImage ? (
                <div className="w-full h-full">
                  <img
                    src={imageUrl || uploadedImage}
                    alt="Your upload"
                    className="w-full h-full object-cover"
                  />

                  {/* Selected Template Preview in Left Corner */}
                  {selectedTemplate && (
                    <div className="absolute top-2 left-2 w-16 h-20 bg-gray-800 rounded-lg overflow-hidden border-2 border-primary z-20 shadow-lg">
                      <div className="absolute top-0 left-0 right-0 bg-primary text-white px-1 py-0.5 text-[6px] font-semibold text-center z-10">
                        Template
                      </div>
                      {selectedTemplate.previewVideo ? (
                        <video
                          src={selectedTemplate.previewVideo}
                          className="w-full h-full object-cover mt-3"
                          muted
                          loop
                          playsInline
                          autoPlay
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center mt-3">
                          <span className="text-gray-500 text-[6px] text-center px-1">{selectedTemplate.name}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Close X button */}
                  <button
                    onClick={() => {
                      setUploadedImage(null);
                      setSelectedTemplate(null);
                      setGeneratedVideo(null);
                      setIsGenerating(false);
                      setCountdown(null);
                      setTaskId(null);
                    }}
                    className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                    {/* Generate button and status if template selected */}
                    {selectedTemplate && (
                      <div className="absolute bottom-2 left-2 right-2">
                        {isGenerating ? (
                          <div className="w-full bg-black/80 backdrop-blur-sm rounded-lg p-2 text-center">
                            <div className="animate-spin rounded-full w-6 h-6 border-t-2 border-b-2 border-primary mx-auto mb-2"></div>
                            <p className="text-white text-xs font-semibold">Generating...</p>
                            {countdown !== null && (
                              <p className="text-primary text-sm font-bold">{countdown}s</p>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={handleGenerate}
                            className="w-full bg-primary hover:bg-primary-dark text-white px-3 py-2 rounded-lg font-semibold transition-colors text-xs"
                          >
                            🎬 Generate Video
                          </button>
                        )}
                      </div>
                    )}
                </div>
              ) : (
                <PhotoUpload onImageSelect={handleImageSelect} />
              )}
            </div>
          </div>

{/* Search and Category Tags in Same Row */}
          <div className="flex gap-2 flex-wrap">
            {/* Search Tag - Same style as category tags */}
            <div className="relative">
              <div className="flex items-center gap-1 px-4 py-2 rounded-full bg-gray-800 border border-slate-700 hover:bg-gray-700 transition-colors">
                <Search className="w-3 h-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm text-white placeholder-gray-500 w-20 focus:w-32 transition-all"
                />
              </div>
            </div>

            {/* Category Tags */}
            {[
              { label: 'All', value: 'all' },
              { label: 'Sway', value: 'sway' },
              { label: 'Shimmy', value: 'shimmy' },
              { label: 'Peach', value: 'peach' },
              { label: 'Halloween', value: 'halloween' },
              { label: 'Playful', value: 'playful' },
              { label: 'Fright Zone', value: 'fright-zone' },
              { label: 'Custom', value: 'custom' },
            ].map((cat) => (
              <button
                key={cat.value}
                onClick={() => {
                  console.log('🎯 Category clicked:', cat.value);
                  setSelectedCategory(cat.value);
                }}
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

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {/* Template items */}
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className={`relative aspect-[9/16] bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform ${
                    selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  {template.previewVideo ? (
                    <video
                      src={template.previewVideo}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                      onMouseEnter={(e) => e.currentTarget.play()}
                      onMouseLeave={(e) => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                      }}
                      onError={(e) => {
                        console.error(`Video failed to load for ${template.id}:`, e.currentTarget.src);
                      }}
                      onLoadStart={() => {
                        console.log(`Video started loading for ${template.id}`);
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                      <span className="text-gray-500 text-xs text-center px-2">
                        {template.name}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        <AgeVerificationModal
          isOpen={showAgeModal}
          onClose={() => setShowAgeModal(false)}
          onVerify={(verified) => {
            if (verified) {
              setShowAgeModal(false);
            }
          }}
        />

        {/* Generated Video Modal */}
        {generatedVideo && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden">
              <div className="relative">
                <video
                  src={generatedVideo}
                  className="w-full aspect-[9/16] object-cover"
                  controls
                  autoPlay
                />
                <button
                  onClick={() => setGeneratedVideo(null)}
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              <div className="p-4 space-y-2">
                <button
                  onClick={handleDownload}
                  className="w-full bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  📥 Download Video
                </button>
                <button
                  onClick={() => setGeneratedVideo(null)}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <FullScreenVideoModal
          videoUrl={generatedVideo || ''}
          isOpen={showFullScreen}
          onClose={() => setShowFullScreen(false)}
          onRetry={handleRetry}
          onDownload={handleDownload}
          onLike={() => setIsLiked(!isLiked)}
          isLiked={isLiked}
        />
      </Layout>
    </>
  );
}

