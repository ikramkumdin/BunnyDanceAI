'use client';

import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import PhotoUpload from '@/components/PhotoUpload';
import AgeVerificationModal from '@/components/AgeVerificationModal';
import FullScreenVideoModal from '@/components/FullScreenVideoModal';
import { templates } from '@/data/templates';
import { useStore } from '@/store/useStore';
import { Template } from '@/types';
import { Sparkles, RotateCcw, Save, Heart, Download, Search } from 'lucide-react';
import RandomWaifuButton from '@/components/RandomWaifuButton';
import { useUser } from '@/hooks/useUser';

export default function GeneratePage() {
  const { user, isLoading: userLoading } = useUser();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  
  const { uploadedImage, isAgeVerified, setSelectedTemplate: setStoreTemplate } = useStore();
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

  // Note: Generation is triggered manually or when template is selected (if auto-generate is desired)

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
    
    // Auto-generate if image is uploaded
    if (uploadedImage && user) {
      console.log('Auto-generating with image and user present');
      // Wait a moment for state to update, then generate
      setTimeout(() => {
        handleGenerate();
      }, 100);
    } else {
      console.log('Not auto-generating - uploadedImage:', !!uploadedImage, 'user:', !!user);
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
    // Filter by search query
    if (searchQuery) {
      const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           template.description.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
    }
    return true;
  });

  // Get signed URLs for template preview videos (only once on mount)
  const [templateVideoUrls, setTemplateVideoUrls] = useState<{ [key: string]: string }>({});
  
  useEffect(() => {
    const fetchSignedUrls = async () => {
      const urls: { [key: string]: string } = {};
      // Fetch for all templates, not just filtered ones
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

    // Only fetch once on mount, not on every filter change
    if (templates.length > 0 && Object.keys(templateVideoUrls).length === 0) {
      fetchSignedUrls();
    }
  }, []); // Empty dependency array - only run once

  return (
    <>
      <Layout showBackButton backLabel="Photo to Video">
        <div className="p-6 flex flex-col gap-6">
          {/* Show upload first if no image uploaded */}
          {!uploadedImage ? (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-2">Upload Your Photo</h1>
                <p className="text-gray-400">Choose an image to animate into a video</p>
              </div>
              <div className="flex justify-center">
                <PhotoUpload onImageSelect={handleImageSelect} />
              </div>
            </div>
          ) : (
            <>
              {/* Unified Preview Section - ABOVE template selection when image is uploaded */}
              {selectedTemplate && (
                <div ref={previewRef} className="flex justify-center">
                  <div className="w-full max-w-[300px] space-y-4">
                    {/* Main Preview Area with Template Overlay and Image Background */}
                    <div className="relative aspect-[9/16] w-full bg-gray-900 rounded-lg overflow-hidden border-2 border-gray-700">
                      {/* Background Image - Show if available and no generated video */}
                      {imageUrl && !generatedVideo && (
                        <img
                          src={imageUrl}
                          alt="Your upload"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      )}

                      {/* Debug State Indicator */}
                      <div className="absolute top-2 left-2 bg-black/80 text-white px-2 py-1 rounded text-[10px] z-30 font-mono">
                        State: {isGenerating ? '🔴 GENERATING' : generatedVideo ? '🟢 COMPLETE' : '⚪ READY'}
                          </div>

                      {/* Small Template Preview in Top Right Corner */}
                      <div className="absolute top-2 right-2 w-20 h-28 bg-gray-800 rounded-lg overflow-hidden border-2 border-primary z-20 shadow-lg">
                        <div className="absolute top-0 left-0 right-0 bg-primary text-white px-1 py-0.5 text-[8px] font-semibold text-center z-10">
                              Template
                            </div>
                            {selectedTemplate.previewVideo && templateVideoUrls[selectedTemplate.id] ? (
                              <video
                                src={templateVideoUrls[selectedTemplate.id] || selectedTemplate.previewVideo}
                                className="w-full h-full object-cover"
                                muted
                                loop
                                playsInline
                                autoPlay
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                            <span className="text-gray-500 text-[8px] text-center px-1">{selectedTemplate.name}</span>
                          </div>
                        )}
                      </div>

                      {/* Preview Content */}
                      {isGenerating ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm w-full h-full z-10">
                          <div className="animate-spin rounded-full w-20 h-20 border-t-4 border-b-4 border-primary mb-6"></div>
                          <p className="text-white text-2xl font-bold mb-2">🎬 GENERATING</p>
                          {countdown !== null && (
                            <div className="bg-primary/20 px-6 py-3 rounded-lg border border-primary mt-4">
                              <p className="text-primary text-3xl font-bold">{countdown}s</p>
                              <p className="text-white text-xs mt-1">remaining</p>
                              </div>
                            )}
                          <p className="text-gray-400 text-sm mt-6">Please wait...</p>
                          {taskId && (
                            <div className="text-center mt-4">
                              <p className="text-gray-500 text-xs">Task ID:</p>
                              <p className="text-gray-400 text-xs font-mono bg-gray-800/50 px-2 py-1 rounded mt-1">{taskId}</p>
                              <p className="text-gray-600 text-xs mt-2">Check Kie.ai dashboard for status</p>
                            </div>
                          )}
                        </div>
                      ) : generatedVideo ? (
                        <>
                          <video
                            src={generatedVideo}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            playsInline
                            autoPlay
                          />
                          {/* Retry and Save Icons */}
                          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2 z-20">
                            <button
                              onClick={handleRetry}
                              className="bg-gray-800/90 hover:bg-gray-700/90 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors backdrop-blur-sm text-xs"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Retry</span>
                            </button>
                            <button
                              onClick={handleSave}
                              className="bg-primary/90 hover:bg-primary-dark/90 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors backdrop-blur-sm text-xs"
                            >
                              <Save className="w-3 h-3" />
                              <span>Save</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                          <div className="text-center">
                            <Sparkles className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="text-gray-200 text-xs font-semibold">Ready to generate</p>
                      </div>
                    </div>
                  )}
                    </div>

                    {/* Generate Button */}
                    {!isGenerating && !generatedVideo && uploadedImage && (
                      <div className="space-y-2">
                        <button
                          onClick={handleGenerate}
                          disabled={!uploadedImage || !selectedTemplate}
                          className="w-full bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                        >
                          🎬 Generate Video (Uses YOUR Image)
                        </button>

                        {/* Info about local development */}
                        <div className="text-center text-blue-400 text-xs mt-2">
                          📝 Local dev: Video generation may take 10-15 minutes. Use &quot;Manual Callback&quot; button when ready.
                            </div>
                        {/* ⚠️ WARNING: Test button - doesn't use your image! */}
                        <div className="text-center text-yellow-400 text-xs mt-2 p-2 bg-yellow-900/20 rounded border border-yellow-500/30">
                          ⚠️ Use &quot;Generate Video&quot; above to create a video with YOUR image
                        </div>

                        {/* Test callback button for local development */}
                        <button
                          onClick={async () => {
                            if (!user || !selectedTemplate || !uploadedImage) return;
                            setIsGenerating(true);
                            setCountdown(120);

                            // Scroll to preview section
                            setTimeout(() => {
                              previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 100);

                            // Simulate callback with a test video URL
                            const testVideoUrl = 'https://tempfile.aiquickdraw.com/r/users/4683d02d-2b94-4c38-a6f7-56ad00f8745b/generated/8fd300ea-3e65-408b-8b80-6b04466ec788/generated_video.mp4';
                            try {
                              const response = await fetch('/api/test-callback', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  userId: user.id,
                                  templateId: selectedTemplate.id,
                                  templateName: selectedTemplate.name,
                                  thumbnail: uploadedImage,
                                  videoUrl: testVideoUrl,
                                }),
                              });
                              if (response.ok) {
                                // Wait a moment for the video to be saved, then start polling
                                setTimeout(() => {
                                  pollVideoStatus();
                                }, 1000);
                              }
                            } catch (error) {
                              console.error('Test callback error:', error);
                              setIsGenerating(false);
                              setCountdown(null);
                            }
                          }}
                          className="w-full bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-xs opacity-50"
                          disabled={isGenerating}
                        >
                          ⚠️ TEST ONLY - Doesn&apos;t use your image
                        </button>

                        {/* Manual callback trigger for when real video is ready */}
                        {isGenerating && taskId && (
                          <div className="space-y-2 mt-2">
                            <div className="text-center text-green-400 text-xs bg-green-900/20 p-2 rounded border border-green-500/30">
                              🎯 Task ID: <code className="bg-green-800 px-1 rounded text-xs">{taskId}</code><br/>
                              Check Kie.ai dashboard for this task, then paste the video URL below:
                            </div>
                            <button
                              onClick={async () => {
                                if (!user || !selectedTemplate || !uploadedImage) return;

                                // Prompt user for the actual video URL from Kie.ai
                                const actualVideoUrl = prompt(`Enter the video URL from Kie.ai dashboard (taskId: ${taskId}):`);
                                if (!actualVideoUrl) return;

                                try {
                                  console.log('🎯 Triggering manual callback with URL:', actualVideoUrl);
                                  const response = await fetch('/api/test-callback', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      userId: user.id,
                                      templateId: selectedTemplate.id,
                                      templateName: selectedTemplate.name,
                                      thumbnail: uploadedImage,
                                      videoUrl: actualVideoUrl,
                                      taskId: taskId, // Include taskId for logging
                                    }),
                                  });

                                  const result = await response.json();
                                  console.log('✅ Manual callback response:', result);

                                  if (response.ok) {
                                    console.log('✅ Manual callback successful - video should appear shortly');
                                    // Trigger one more poll to check immediately
                                    setTimeout(() => {
                                      pollVideoStatus(Date.now(), taskId);
                                    }, 1000);
                                  } else {
                                    alert(`Manual callback failed: ${result.error}`);
                                  }
                                } catch (error) {
                                  console.error('Manual callback error:', error);
                                  alert(`Manual callback failed: ${error}`);
                                }
                              }}
                              className="w-full bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-xs"
                            >
                              🎯 Manual Callback (Paste Kie.ai Video URL)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                      </div>
                    </div>
                  )}

              {/* Template Selection - Show when image is uploaded but no template selected */}
              {!selectedTemplate && uploadedImage && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h2 className="text-xl font-bold mb-2">Choose a Dance Style</h2>
                      <p className="text-gray-400">Select a template to animate your photo</p>
                    </div>
                    {/* Search and Category Tabs in same row */}
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Small Search Bar */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search templates..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full max-w-xs bg-slate-800 border border-slate-700 rounded-full pl-9 pr-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                        />
                      </div>

                      {/* Category Tabs (without trending) */}
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { label: 'All', value: 'all' },
                          { label: 'For You', value: 'for-you' },
                          { label: 'Sway', value: 'sway' },
                          { label: 'Shimmy', value: 'shimmy' },
                          { label: 'Peach', value: 'peach' },
                          { label: 'Halloween', value: 'halloween' },
                          { label: 'Playful', value: 'playful' },
                          { label: 'Fright Zone', value: 'fright-zone' },
                        ].map((cat) => (
                          <button
                            key={cat.value}
                            className="px-4 py-2 rounded-full bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors text-sm"
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {filteredTemplates.map((template) => (
                        <div
                          key={template.id}
                          onClick={() => handleTemplateSelect(template)}
                          className={`aspect-[9/16] bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform ${
                            selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''
                          }`}
                        >
                          {template.previewVideo && templateVideoUrls[template.id] ? (
                            <video
                              src={templateVideoUrls[template.id] || template.previewVideo}
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
                              <span className="text-gray-500 text-xs text-center px-2">
                                {template.name}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                      </div>
                    </div>
              )}
            </>
          )}
        </div>
      </Layout>

      <AgeVerificationModal
        isOpen={showAgeModal}
        onClose={() => setShowAgeModal(false)}
        onVerify={(verified) => {
          if (verified) {
            setShowAgeModal(false);
          }
        }}
      />

      <FullScreenVideoModal
        videoUrl={generatedVideo || ''}
        isOpen={showFullScreen}
        onClose={() => setShowFullScreen(false)}
        onRetry={handleRetry}
        onDownload={handleDownload}
        onLike={() => setIsLiked(!isLiked)}
        isLiked={isLiked}
      />
    </>
  );
}
