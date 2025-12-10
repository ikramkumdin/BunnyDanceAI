'use client';

import { useState, useCallback } from 'react';
import { templates } from '@/data/templates';
import { Template } from '@/types';
import { X, Search, Sparkles } from 'lucide-react';
import PhotoUpload from '@/components/PhotoUpload';
import { useStore } from '@/store/useStore';
import { useUser } from '@/hooks/useUser';
import Layout from '@/components/Layout';
import { saveImage, saveVideo } from '@/lib/firestore';

export default function GeneratePage() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [textPrompt, setTextPrompt] = useState<string>('');
  const [activeMode, setActiveMode] = useState<'image-to-video' | 'text-to-video' | 'text-to-image'>('image-to-video');

  const { setSelectedTemplate: setStoreTemplate, setUploadedImage: setStoreUploadedImage } = useStore();
  const { user } = useUser();

  // Save image to assets
  const saveImageToAssets = async (imageUrl: string, prompt?: string, source: 'text-to-image' | 'image-to-video' = 'text-to-image') => {
    if (!user) return;
    
    try {
      await saveImage({
        userId: user.id,
        imageUrl,
        prompt: prompt || textPrompt,
        source,
        tags: ['photo', source],
        type: 'image',
        createdAt: new Date().toISOString(),
      });
      console.log('✅ Image saved to assets');
    } catch (error) {
      console.error('❌ Error saving image to assets:', error);
    }
  };

  // Save video to assets
  const saveVideoToAssets = async (videoUrl: string, templateName: string, templateId: string, thumbnail?: string) => {
    if (!user) return;
    
    try {
      await saveVideo({
        userId: user.id,
        videoUrl,
        thumbnail: thumbnail || videoUrl,
        templateId,
        templateName,
        isWatermarked: false,
        tags: ['video'],
        type: 'video',
        createdAt: new Date().toISOString(),
      });
      console.log('✅ Video saved to assets');
    } catch (error) {
      console.error('❌ Error saving video to assets:', error);
    }
  };

  // Handle image selection
  const handleImageSelect = (imageData: { gcpUrl: string; base64Url: string }) => {
    setUploadedImage(imageData.gcpUrl);
    setImageUrl(imageData.gcpUrl); // For API calls
    setBase64Image(imageData.base64Url); // For immediate display
    setStoreUploadedImage(imageData.gcpUrl);
    setGeneratedVideo(null);
  };

  // Handle template selection
  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setStoreTemplate(template);
  };

  // Poll for video status
  const pollVideoStatus = useCallback(async (startTime = Date.now(), taskId = null) => {
    try {
      // First try polling Kie.ai directly for task status
      if (taskId) {
        console.log('🔍 Polling Kie.ai for task status...');
        try {
          const pollResponse = await fetch(`/api/poll-task?taskId=${taskId}`);
          if (pollResponse.ok) {
            const pollData = await pollResponse.json();
            console.log('📊 Kie.ai poll response:', pollData);

            // Check if video is ready (look for various possible response formats)
            const videoUrl = pollData.videoUrl || pollData.url || pollData.result?.videoUrl || pollData.output?.videoUrl;
            if (videoUrl && (pollData.status === 'completed' || pollData.status === 'success' || pollData.completed)) {
              console.log('🎬 Video ready from Kie.ai:', videoUrl);

              // Save the video to our database
              const saveResponse = await fetch('/api/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  videoUrl: videoUrl,
                  taskId: taskId,
                  userId: user?.id,
                  templateId: 'unknown', // We don't have this info
                  templateName: 'Generated Video',
                  thumbnail: 'unknown'
                })
              });

              if (saveResponse.ok) {
                setGeneratedVideo(videoUrl);
                setIsGenerating(false);
                // Save to assets
                if (selectedTemplate) {
                  saveVideoToAssets(videoUrl, selectedTemplate.name, selectedTemplate.id);
                } else {
                  // Text-to-video or unknown source
                  saveVideoToAssets(videoUrl, 'Text-to-Video', 'text-to-video', videoUrl);
                }
                return;
              }
            }
          }
        } catch (pollError) {
          console.log('⚠️ Kie.ai polling failed, falling back to database check');
        }
      }

      // Fallback: Check our database for completed videos
      console.log('🔍 Checking database for completed videos...');
      const response = await fetch(`/api/check-video?userId=${user?.id}${taskId ? `&taskId=${taskId}` : ''}`);
      const data = await response.json();

      console.log('📊 Database check response:', data);

      if (data.ready && data.videoUrl) {
        console.log('🎬 Video ready from database:', data.videoUrl);
        setGeneratedVideo(data.videoUrl);
        setIsGenerating(false);
        // Save to assets
        if (selectedTemplate) {
          saveVideoToAssets(data.videoUrl, selectedTemplate.name, selectedTemplate.id);
        } else {
          // Text-to-video or unknown source
          saveVideoToAssets(data.videoUrl, 'Text-to-Video', 'text-to-video', data.videoUrl);
        }
        return;
      }

      // Continue polling if not ready (max 15 minutes)
      const elapsed = Date.now() - startTime;
      const elapsedMinutes = Math.round(elapsed / (60 * 1000));
      console.log(`⏳ Polling... ${elapsedMinutes}/15 minutes elapsed`);

      // Increase max polling time to 20 minutes (Kie.ai can be slow)
      // Check every 10 seconds
      if (elapsed < 20 * 60 * 1000) { 
        setTimeout(() => pollVideoStatus(startTime, taskId), 10000); 
      } else {
        console.log('⏰ Video generation timeout after 20 minutes');
        setIsGenerating(false);
        alert('Video generation is taking longer than expected. The video may still complete - please refresh the page in a few minutes to check.');
      }
    } catch (error) {
      console.error('Polling error:', error);
      setIsGenerating(false);
      alert('Error checking video status. Please try again.');
    }
  }, [user?.id, selectedTemplate]);

  // Handle generation
  const handleGenerate = async () => {
    if (!uploadedImage || !selectedTemplate || !user) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: uploadedImage,
          templateId: selectedTemplate.id,
          intensity: 'spicy',
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.videoUrl) {
          // Immediate result (rare)
          setGeneratedVideo(data.videoUrl);
          // Save to assets
          if (selectedTemplate) {
            saveVideoToAssets(data.videoUrl, selectedTemplate.name, selectedTemplate.id);
          }
        } else if (data.taskId) {
          // Async generation - start polling
          console.log('🎬 Started async generation, polling for completion...');
          pollVideoStatus(Date.now(), data.taskId);
        } else {
          alert('Generation started but no task ID received. Please check back later.');
          setIsGenerating(false);
        }
      } else {
        alert('Generation failed: ' + (data.error || 'Unknown error'));
        setIsGenerating(false);
      }
    } catch (error) {
      console.error('Generation error:', error);
      alert('Failed to generate video. Please try again.');
      setIsGenerating(false);
    }
  };

  // Handle text-to-video generation
  const handleTextToVideo = async () => {
    if (!textPrompt || !user) {
      alert('Please enter a prompt for your video');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-text-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textPrompt,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.videoUrl) {
          // Immediate result (rare)
          setGeneratedVideo(data.videoUrl);
          // Save to assets
          saveVideoToAssets(data.videoUrl, 'Text-to-Video', 'text-to-video', data.videoUrl);
        } else if (data.taskId) {
          // Async generation - start polling
          console.log('🎬 Started text-to-video generation, polling for completion...');
          pollVideoStatus(Date.now(), data.taskId);
        } else {
          alert('Generation started but no task ID received. Please check back later.');
          setIsGenerating(false);
        }
      } else {
        alert('Generation failed: ' + (data.error || 'Unknown error'));
        setIsGenerating(false);
      }
    } catch (error) {
      console.error('Text-to-video error:', error);
      alert('Failed to generate video. Please try again.');
      setIsGenerating(false);
    }
  };

  // Poll for image status
  const pollImageStatus = useCallback(async (startTime = Date.now(), taskId = null, provider = 'kie') => {
    try {
      if (taskId) {
        console.log(`🔍 Polling for image status (${provider})...`);
        const pollResponse = await fetch(`/api/poll-image-task?taskId=${taskId}&provider=${provider}`);
        
        if (pollResponse.ok) {
          const pollData = await pollResponse.json();
          console.log('📊 Image poll response:', pollData);

          // Check if image is ready - be flexible with where URL might be
          const imageUrl = pollData.imageUrl || pollData.data?.imageUrl || pollData.data?.response;
          console.log('🔍 Extracted image URL:', imageUrl);
          
          if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
            console.log('🎨 Image ready:', imageUrl);
            setUploadedImage(imageUrl);
            setBase64Image(imageUrl);
            setImageUrl(imageUrl);
            setIsGenerating(false);
            // Save to assets
            saveImageToAssets(imageUrl, textPrompt, 'text-to-image');
            return;
          }
          
          // If we have an image URL in an array
          if (Array.isArray(imageUrl) && imageUrl.length > 0 && imageUrl[0].startsWith('http')) {
            console.log('🎨 Image ready (from array):', imageUrl[0]);
            setUploadedImage(imageUrl[0]);
            setBase64Image(imageUrl[0]);
            setImageUrl(imageUrl[0]);
            setIsGenerating(false);
            // Save to assets
            saveImageToAssets(imageUrl[0], textPrompt, 'text-to-image');
            return;
          }

          // Check for explicit failure
          if (pollData.status === 'failed' || pollData.data?.status === 'FAILED') {
            console.error('❌ Image generation failed:', pollData.error || pollData.data?.errorMessage);
            alert('Image generation failed: ' + (pollData.error || pollData.data?.errorMessage || 'Unknown error'));
            setIsGenerating(false);
            return;
          }
        }
      }

      // Continue polling if not ready (max 10 minutes for Kie.ai images - they're slow!)
      const elapsed = Date.now() - startTime;
      const elapsedMinutes = Math.round(elapsed / (60 * 1000));
      const maxMinutes = provider === 'replicate' ? 5 : 10; // Kie.ai needs more time
      
      console.log(`⏳ Polling image (${provider})... ${elapsedMinutes}/${maxMinutes} minutes elapsed`);

      if (elapsed < maxMinutes * 60 * 1000) { 
        // Poll every 5 seconds for first 2 minutes, then every 10 seconds
        const pollInterval = elapsed < 2 * 60 * 1000 ? 5000 : 10000;
        setTimeout(() => pollImageStatus(startTime, taskId, provider), pollInterval);
      } else {
        console.log(`⏰ Image generation timeout after ${maxMinutes} minutes`);
        console.log('💡 The image might still be generating. Check Kie.ai dashboard: https://kie.ai/logs');
        
        // Try one last check of the cache (in case callback arrived during timeout)
        if (taskId && provider === 'kie') {
          console.log('🔄 Doing final cache check before timeout...');
          const finalCheck = await fetch(`/api/poll-image-task?taskId=${taskId}&provider=${provider}`);
          if (finalCheck.ok) {
            const finalData = await finalCheck.json();
            const finalImageUrl = finalData.imageUrl || finalData.data?.imageUrl;
            if (finalImageUrl && typeof finalImageUrl === 'string' && finalImageUrl.startsWith('http')) {
              console.log('🎉 Found image in final cache check!', finalImageUrl);
              setUploadedImage(finalImageUrl);
              setBase64Image(finalImageUrl);
              setImageUrl(finalImageUrl);
              setIsGenerating(false);
              // Save to assets
              saveImageToAssets(finalImageUrl, textPrompt, 'text-to-image');
              return;
            }
          }
        }
        
        setIsGenerating(false);
        const message = `Image generation timed out after ${maxMinutes} minutes.\n\n` +
          `Task ID: ${taskId}\n\n` +
          `The image might still be processing. Please:\n` +
          `1. Go to https://kie.ai/logs\n` +
          `2. Find task ID: ${taskId}\n` +
          `3. If it shows "SUCCESS", click "Retry Callback" button\n` +
          `4. Then refresh this page and try again`;
        alert(message);
      }
    } catch (error) {
      console.error('Image polling error:', error);
      setIsGenerating(false);
      alert('Error checking image status. Please try again.');
    }
  }, []);

  // Handle text-to-image generation
  const handleTextToImage = async () => {
    if (!textPrompt || !user) {
      alert('Please enter a prompt for your image');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-text-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textPrompt,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.imageUrl) {
          // Immediate result (rare)
          setUploadedImage(data.imageUrl);
          setBase64Image(data.imageUrl);
          setImageUrl(data.imageUrl);
          setIsGenerating(false);
          // Save to assets
          saveImageToAssets(data.imageUrl, textPrompt, 'text-to-image');
        } else if (data.taskId) {
          // Async generation - start polling
          const provider = data.provider || 'kie';
          console.log(`🎨 Started image generation with ${provider}, polling for completion...`);
          pollImageStatus(Date.now(), data.taskId, provider);
        } else {
          alert('Generation started but no task ID received.');
          setIsGenerating(false);
        }
      } else {
        alert('Generation failed: ' + (data.error || 'Unknown error'));
        setIsGenerating(false);
      }
    } catch (error) {
      console.error('Text-to-image error:', error);
      alert('Failed to generate image. Please try again.');
      setIsGenerating(false);
    }
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

  return (
    <Layout>
      <div className="flex flex-col gap-4 p-6">
        {/* Mode Toggle - Trending Style Tabs */}
        <div className="flex gap-4 border-b border-gray-800 pb-2 mb-2">
          <button
            onClick={() => setActiveMode('image-to-video')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeMode === 'image-to-video'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            IMAGE TO VIDEO
          </button>
          <button
            onClick={() => setActiveMode('text-to-video')}
            className={`px-4 py-2 font-semibold transition-colors flex items-center gap-2 ${
              activeMode === 'text-to-video'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            TEXT TO VIDEO
          </button>
          <button
            onClick={() => setActiveMode('text-to-image')}
            className={`px-4 py-2 font-semibold transition-colors flex items-center gap-2 ${
              activeMode === 'text-to-image'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            TEXT TO IMAGE
          </button>
        </div>

        {/* Main Content Area - Same size as templates */}
        <div className="flex justify-center">
          <div className="relative aspect-[9/16] w-80 bg-gray-800 rounded-lg overflow-hidden">
            {/* Image-to-Video Mode: Show uploader */}
            {activeMode === 'image-to-video' && (
              <>
            {uploadedImage ? (
              <div className="w-full h-full relative bg-gray-800 rounded-lg overflow-hidden">
                <img
                  src={base64Image || uploadedImage}
                  alt="Your upload"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // If base64 fails, try GCP URL, then signed URL
                    const imgElement = e.currentTarget;
                    const currentSrc = imgElement.src;
                    if (currentSrc === base64Image && uploadedImage) {
                      imgElement.src = uploadedImage;
                    } else if (currentSrc.startsWith('https://storage.googleapis.com/')) {
                      fetch(`/api/get-signed-url?path=${encodeURIComponent(currentSrc)}`)
                        .then((res) => res.json())
                        .then((data) => {
                          if (data.url) {
                            imgElement.src = data.url;
                          } else if (base64Image) {
                            imgElement.src = base64Image;
                          }
                        })
                        .catch(() => {
                          if (base64Image && imgElement.src !== base64Image) {
                            imgElement.src = base64Image;
                          }
                        });
                    }
                  }}
                />

                {/* Close X button */}
                <button
                  onClick={() => {
                    setUploadedImage(null);
                    setSelectedTemplate(null);
                    setGeneratedVideo(null);
                  }}
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              ) : (
                <PhotoUpload onImageSelect={handleImageSelect} />
              )}
              </>
            )}

            {/* Text-to-Video Mode: Show text area with preview */}
            {activeMode === 'text-to-video' && (
              <div className="w-full h-full flex flex-col p-4 gap-3">
                <div className="flex-1 flex flex-col gap-2">
                  <label className="text-white font-semibold text-sm">Describe your video:</label>
                  <textarea
                    value={textPrompt}
                    onChange={(e) => setTextPrompt(e.target.value)}
                    placeholder="A person dancing in a park with autumn leaves, cinematic lighting, 4K quality..."
                    className="flex-1 bg-gray-900 text-white px-3 py-3 rounded-lg text-sm border border-gray-700 focus:border-primary focus:outline-none resize-none"
                  />
                  
                  {textPrompt && (
                    <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Preview:</p>
                      <p className="text-sm text-white line-clamp-4">{textPrompt}</p>
                    </div>
                  )}
                </div>

                {!isGenerating ? (
                  <button
                    onClick={handleTextToVideo}
                    disabled={!textPrompt}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-semibold transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Video
                  </button>
                ) : (
                  <div className="w-full bg-black/80 backdrop-blur-sm rounded-lg p-3 text-center">
                    <div className="animate-spin rounded-full w-8 h-8 border-t-2 border-b-2 border-purple-600 mx-auto mb-2"></div>
                    <p className="text-white text-sm font-semibold">Generating your video...</p>
                  </div>
                )}
              </div>
            )}

            {/* Text-to-Image Mode: Show text area with preview */}
            {activeMode === 'text-to-image' && (
              <div className="w-full h-full flex flex-col p-4 gap-3">
                {!uploadedImage ? (
                  <>
                    <div className="flex-1 flex flex-col gap-2">
                      <label className="text-white font-semibold text-sm">Describe your image:</label>
                      <textarea
                        value={textPrompt}
                        onChange={(e) => setTextPrompt(e.target.value)}
                        placeholder="A beautiful sunset over mountains, photorealistic, highly detailed, 4K..."
                        className="flex-1 bg-gray-900 text-white px-3 py-3 rounded-lg text-sm border border-gray-700 focus:border-primary focus:outline-none resize-none"
                      />
                      
                      {textPrompt && (
                        <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-3">
                          <p className="text-xs text-gray-400 mb-1">Preview:</p>
                          <p className="text-sm text-white line-clamp-4">{textPrompt}</p>
                        </div>
                      )}
                    </div>

                    {!isGenerating ? (
                      <button
                        onClick={handleTextToImage}
                        disabled={!textPrompt}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-semibold transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Generate Image
                      </button>
                    ) : (
                      <div className="w-full bg-black/80 backdrop-blur-sm rounded-lg p-3 text-center">
                        <div className="animate-spin rounded-full w-8 h-8 border-t-2 border-b-2 border-green-600 mx-auto mb-2"></div>
                        <p className="text-white text-sm font-semibold">Generating your image...</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full relative">
                    <img
                      src={uploadedImage}
                      alt="Generated image"
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      onClick={() => {
                        setUploadedImage(null);
                        setTextPrompt('');
                      }}
                      className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                    <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-sm rounded-lg p-2">
                      <p className="text-xs text-white">✨ Image generated! You can now use it for video generation.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

              {/* Selected Template Preview in Left Corner - Only for image-to-video mode */}
              {activeMode === 'image-to-video' && selectedTemplate && (
                <div className="absolute top-2 left-2 w-20 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-primary z-50 shadow-lg">
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

              {/* Image-to-Video Mode: Generate Button */}
              {activeMode === 'image-to-video' && selectedTemplate && uploadedImage && (
                <div className="absolute bottom-4 left-4 right-4">
                  {isGenerating ? (
                    <div className="w-full bg-black/80 backdrop-blur-sm rounded-lg p-3 text-center">
                      <div className="animate-spin rounded-full w-8 h-8 border-t-2 border-b-2 border-primary mx-auto mb-2"></div>
                      <p className="text-white text-sm font-semibold">Generating your video...</p>
                    </div>
                  ) : (
                    <button
                      onClick={handleGenerate}
                      className="w-full bg-primary hover:bg-primary-dark text-white px-4 py-3 rounded-lg font-semibold transition-colors text-sm"
                    >
                      Generate Video
                    </button>
                  )}
                </div>
              )}


            </div>
        </div>

        {/* Template Selection - Only show for image-to-video mode */}
        {activeMode === 'image-to-video' && (
        <div className="space-y-4">
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
              { label: 'JK', value: 'jk' },
              { label: 'Catgirl', value: 'catgirl' },
              { label: 'Custom', value: 'custom' },
            ].map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
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
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              onClick={() => uploadedImage && handleTemplateSelect(template)}
              className={`relative aspect-[9/16] bg-gray-800 rounded-lg overflow-hidden transition-all ${
                uploadedImage
                  ? `cursor-pointer hover:scale-105 ${selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''}`
                  : 'cursor-not-allowed opacity-50'
              }`}
            >
              {template.previewVideo ? (
                <video
                  src={template.previewVideo}
                  className="w-full h-full object-cover"
                  muted
                  loop
                  playsInline
                  autoPlay
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                  <span className="text-gray-500 text-xs text-center px-2">{template.name}</span>
                </div>
              )}
          </div>
          ))}
        </div>

        </div>
        )}
      </div>
    </Layout>
  );
}
