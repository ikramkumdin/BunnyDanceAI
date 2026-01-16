'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { templates } from '@/data/templates';
import { Template } from '@/types';
import { Check, Download, Save, Search, Share2, Sparkles, X } from 'lucide-react';
import PhotoUpload from '@/components/PhotoUpload';
import { useStore } from '@/store/useStore';
import { useUser } from '@/hooks/useUser';
import Layout from '@/components/Layout';
import { saveImage, saveVideo } from '@/lib/firestore';
import { MAX_RETRIES, POLL_INTERVAL_MS } from '@/config/polling';
import { motion, AnimatePresence } from 'framer-motion';
import NextImage from 'next/image';
import { AlertCircle } from 'lucide-react';

export default function GeneratePage() {
  const router = useRouter();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [showGeneratedVideoActions, setShowGeneratedVideoActions] = useState(false);
  const [isSavingGeneratedVideo, setIsSavingGeneratedVideo] = useState(false);
  const [hasSavedGeneratedVideo, setHasSavedGeneratedVideo] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [textPrompt, setTextPrompt] = useState<string>('');
  const [activeMode, setActiveMode] = useState<'image-to-video' | 'text-to-video' | 'text-to-image'>('image-to-video');
  const [showGeneratedImageActions, setShowGeneratedImageActions] = useState(false);
  const [isSavingGeneratedImage, setIsSavingGeneratedImage] = useState(false);
  const [hasSavedGeneratedImage, setHasSavedGeneratedImage] = useState(false);
  const [videoUrls, setVideoUrls] = useState<{ [key: string]: string }>({});
  const [showTemplateHint, setShowTemplateHint] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showSocialShare, setShowSocialShare] = useState(false);

  const {
    selectedTemplate: persistedTemplate,
    uploadedImage: persistedImage,
    setSelectedTemplate: setStoreTemplate,
    setUploadedImage: setStoreUploadedImage,
    addVideo: addVideoToStore,
    addImage: addImageToStore
  } = useStore();
  const { user } = useUser();
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeTaskIdRef = useRef<string | null>(null);
  const activeModeRef = useRef<'image-to-video' | 'text-to-video' | 'text-to-image' | null>('image-to-video');

  const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000); // Auto-dismiss after 5s
  }, []);

  // Clear any existing timeouts when the component unmounts
  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, []);

  // Sync with store on mount (handles "Use for Video" and Home page template selection)
  useEffect(() => {
    if (persistedImage && !uploadedImage) {
      console.log('🔄 Syncing image from store:', persistedImage);
      setUploadedImage(persistedImage);
      setImageUrl(persistedImage);

      // Trigger template hint if we have an image but no template yet
      if (activeMode === 'image-to-video' && !selectedTemplate && !persistedTemplate) {
        setShowTemplateHint(true);
      }
    }
    if (persistedTemplate && !selectedTemplate) {
      console.log('🔄 Syncing template from store:', persistedTemplate.id);
      setSelectedTemplate(persistedTemplate);
      setShowTemplateHint(false);
    }
  }, [persistedImage, persistedTemplate, activeMode]);

  // Handle mode change and clear session states
  const handleModeChange = (mode: 'image-to-video' | 'text-to-video' | 'text-to-image') => {
    setActiveMode(mode);
    setGeneratedVideo(null);
    setUploadedImage(null);
    setBase64Image(null);
    setImageUrl(null);
    setTextPrompt('');
    setHasSavedGeneratedVideo(false);
    setHasSavedGeneratedImage(false);
    setShowGeneratedVideoActions(false);
    setShowGeneratedImageActions(false);
    setShowTemplateHint(false);
    setShowSocialShare(false);
    setIsGenerating(false);
    setGenerationProgress('');
    activeTaskIdRef.current = null;
    activeModeRef.current = mode; // Update ref for polling validation
    setStoreTemplate(null);
    setStoreUploadedImage(null);
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
    }
  };

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

  // Save image to assets
  const saveImageToAssets = useCallback(async (imageUrl: string, prompt?: string, source: 'text-to-image' | 'image-to-video' = 'text-to-image'): Promise<boolean> => {
    if (!user) return false;

    try {
      const imageId = await saveImage({
        userId: user.id,
        imageUrl,
        prompt: prompt || textPrompt,
        source,
        tags: ['photo', source],
        type: 'image',
        createdAt: new Date().toISOString(),
      });

      // Update local store for immediate persistence
      addImageToStore({
        id: imageId,
        userId: user.id,
        imageUrl,
        prompt: prompt || textPrompt,
        source,
        tags: ['photo', source],
        type: 'image',
        createdAt: new Date().toISOString(),
      });
      console.log('✅ Image saved to assets');
      return true;
    } catch (error) {
      console.error('❌ Error saving image to assets:', error);
      return false;
    }
  }, [user, textPrompt]);

  // Save video to assets
  const saveVideoToAssets = useCallback(async (videoUrl: string, templateName: string, templateId: string, thumbnail?: string) => {
    if (!user) return;

    try {
      const videoId = await saveVideo({
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

      // Update local store for immediate persistence
      addVideoToStore({
        id: videoId,
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
  }, [user]);

  const saveGeneratedVideoToAssets = useCallback(async () => {
    if (!generatedVideo) return;
    if (!user) {
      showNotification('Please sign in to save to Assets.', 'error');
      return;
    }
    if (hasSavedGeneratedVideo) return;

    setIsSavingGeneratedVideo(true);
    try {
      await saveVideoToAssets(generatedVideo, 'Text-to-Video', 'text-to-video', generatedVideo);
      setHasSavedGeneratedVideo(true);
      showNotification('Video saved to assets!', 'success');
    } finally {
      setIsSavingGeneratedVideo(false);
    }
  }, [generatedVideo, user, hasSavedGeneratedVideo, saveVideoToAssets, showNotification]);

  const downloadVideo = useCallback((url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);

  const shareVideo = useCallback(async (url: string) => {
    try {
      const nav: any = navigator;
      if (nav?.share) {
        await nav.share({ title: 'Generated video', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showNotification('Video link copied to clipboard!', 'success');
    } catch (e) {
      console.error('Share failed:', e);
      showNotification('Could not share automatically. Try downloading or copying the link.', 'error');
    }
  }, [showNotification]);

  // Handle image selection
  const handleImageSelect = (imageData: { gcpUrl: string; base64Url: string }) => {
    // Always show a preview. If upload failed, fall back to base64 preview,
    // but keep imageUrl null so generation is blocked until we have a real URL.
    const previewUrl = imageData.gcpUrl || imageData.base64Url;
    setUploadedImage(previewUrl);
    setImageUrl(imageData.gcpUrl || null); // For API calls (must be http URL)
    setBase64Image(imageData.base64Url); // For immediate display
    if (imageData.gcpUrl) {
      setStoreUploadedImage(imageData.gcpUrl);
    }
    setGeneratedVideo(null);
    if (activeMode === 'image-to-video' && !selectedTemplate) {
      setShowTemplateHint(true);
    }
  };

  // Handle template selection
  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setStoreTemplate(template);
    setShowTemplateHint(false);
  };

  // Poll for video status
  const pollVideoStatus = useCallback(async (startTime = Date.now(), taskId = null) => {
    const initialMode = activeMode; // Capture mode when poll started
    try {
      // First try polling Kie.ai directly for task status
      if (taskId) {
        console.log('🔍 Polling Kie.ai for task status...');
        try {
          const pollResponse = await fetch(`/api/poll-task?taskId=${taskId}`);
          if (pollResponse.ok) {
            const pollData = await pollResponse.json();
            console.log('📊 Kie.ai poll response:', pollData);

            // Check if this task is still the active one
            if (activeTaskIdRef.current !== taskId) {
              console.log('🛑 Polling result ignored: task ID mismatch (mode might have changed)');
              return;
            }

            // Check if video is ready (look for various possible response formats)
            const videoUrl = pollData.videoUrl || pollData.url || pollData.result?.videoUrl || pollData.output?.videoUrl;

            if (pollData.status === 'failed' || pollData.status === 'error') {
              const errorMsg = pollData.error || pollData.details || pollData.msg || 'Video generation failed';
              console.error('❌ Video generation failed at provider:', errorMsg);
              showNotification(`Generation Failed: ${errorMsg}`, 'error');
              setIsGenerating(false);
              return; // STOP POLLING
            }

            if (videoUrl && (pollData.status === 'completed' || pollData.status === 'success' || pollData.completed)) {
              // Check if mode or task changed while fetching
              if (activeModeRef.current !== initialMode || (taskId && activeTaskIdRef.current !== taskId)) {
                console.log('🛑 Poll result discarded: mode or task changed');
                return;
              }
              console.log('🎬 Video ready from Kie.ai:', videoUrl);
              setGeneratedVideo(videoUrl);
              setShowGeneratedVideoActions(true);
              setHasSavedGeneratedVideo(false);
              setIsGenerating(false);
              return;
            }
          }
        } catch (pollError) {
          console.log('⚠️ Kie.ai polling failed, falling back to database check');
        }
      }

      // Fallback: Check our database for completed videos
      console.log('🔍 Checking database for completed videos...');

      // Check if task is still active before making network call
      if (taskId && activeTaskIdRef.current !== taskId) return;
      if (activeModeRef.current !== activeMode) return;

      const response = await fetch(`/api/check-video?userId=${user?.id}${taskId ? `&taskId=${taskId}` : ''}`);
      const data = await response.json();

      console.log('📊 Database check response:', data);

      if (data.ready && data.videoUrl) {
        // Double check task and mode before updating state
        if ((taskId && activeTaskIdRef.current !== taskId) || activeModeRef.current !== initialMode) {
          console.log('🛑 Database result ignored: task ID mismatch or mode changed');
          return;
        }

        console.log('🎬 Video ready from database:', data.videoUrl);
        setGeneratedVideo(data.videoUrl);
        setShowGeneratedVideoActions(true);
        setHasSavedGeneratedVideo(false);
        setIsGenerating(false);
        // Do NOT save again (DB already has it)
        return;
      }

      // Continue polling if not ready (max 15 minutes)
      const elapsed = Date.now() - startTime;
      const elapsedMinutes = Math.round(elapsed / (60 * 1000));
      console.log(`⏳ Polling... ${elapsedMinutes}/15 minutes elapsed`);

      // Increase max polling time to 20 minutes (Kie.ai can be slow)
      // Check every 10 seconds
      if (elapsed < 20 * 60 * 1000) {
        // Only schedule next poll if this is still the active task
        if (!taskId || activeTaskIdRef.current === taskId) {
          pollingTimeoutRef.current = setTimeout(() => pollVideoStatus(startTime, taskId), 10000);
        }
      } else {
        console.log('⏰ Video generation timeout after 20 minutes');
        setIsGenerating(false);
        showNotification('Video generation is taking longer than expected. Please check back in a few minutes.', 'error');
      }
    } catch (error) {
      console.error('Polling error:', error);
      setIsGenerating(false);
      showNotification('Error checking video status. Please try again.', 'error');
    }
  }, [activeMode, showNotification]);

  // Handle generation
  const handleGenerate = async () => {
    if (!uploadedImage || !selectedTemplate || !user) return;
    const hasHttpImageUrl = !!imageUrl && imageUrl.startsWith('http');
    const hasBase64Image = !!base64Image && base64Image.startsWith('data:image/');
    if (!hasHttpImageUrl && !hasBase64Image) {
      showNotification('Image is not ready yet. Please wait for the preview.', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Always include base64 when available so the server can upload directly to Kie File Upload API.
          // This avoids Kie failing to fetch from GCS URLs (signed/public access quirks).
          imageUrl: hasHttpImageUrl ? imageUrl : undefined,
          imageDataUrl: hasBase64Image ? base64Image : undefined,
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
          activeTaskIdRef.current = data.taskId;
          pollVideoStatus(Date.now(), data.taskId);
        } else {
          showNotification('Generation started but no task ID received. Please check back later.', 'error');
          setIsGenerating(false);
        }
      } else {
        showNotification(`Generation failed: ${data.error || 'Unknown error'}`, 'error');
        setIsGenerating(false);
      }
    } catch (error) {
      console.error('Generation error:', error);
      showNotification('Failed to generate video. Please try again.', 'error');
      setIsGenerating(false);
    }
  };

  // Handle text-to-video generation
  const handleTextToVideo = async () => {
    if (!textPrompt || !user) {
      showNotification('Please enter a prompt for your video', 'error');
      return;
    }

    setIsGenerating(true);
    setGeneratedVideo(null);
    setShowGeneratedVideoActions(false);
    setHasSavedGeneratedVideo(false);
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
          setShowGeneratedVideoActions(true);
          setHasSavedGeneratedVideo(false);
          // Save to assets
          // For text-to-video, user saves via the details sheet (like text-to-image).
        } else if (data.taskId) {
          // Async generation - start polling
          console.log('🎬 Started text-to-video generation, polling for completion...');
          activeTaskIdRef.current = data.taskId;
          pollVideoStatus(Date.now(), data.taskId);
        } else {
          showNotification('Generation started but no task ID received. Please check back later.', 'error');
          setIsGenerating(false);
        }
      } else {
        showNotification(`Generation failed: ${data.error || 'Unknown error'}`, 'error');
        setIsGenerating(false);
      }
    } catch (error) {
      console.error('Text-to-video error:', error);
      showNotification('Failed to generate video. Please try again.', 'error');
      setIsGenerating(false);
    }
  };

  // Poll for image status (single check only now, loop handled by handleTextToImage)
  const fetchImageStatus = useCallback(async (taskId: string, provider: string) => {
    const pollResponse = await fetch(`/api/poll-image-task?taskId=${taskId}&provider=${provider}`);
    if (!pollResponse.ok) {
      throw new Error(`Polling API error: ${pollResponse.status}`);
    }
    return await pollResponse.json();
  }, []);

  const downloadImage = useCallback(async (url: string) => {
    try {
      let res;
      try {
        // Try direct fetch first
        res = await fetch(url, { method: 'GET', mode: 'cors' });
        if (!res.ok) throw new Error('Direct fetch failed');
      } catch (directError) {
        console.log('Direct image fetch failed (likely CORS), trying proxy...');
        // Fallback to proxy
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
        res = await fetch(proxyUrl, { method: 'GET' });
        if (!res.ok) throw new Error(`Proxy request failed: ${res.status}`);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `generated-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      console.warn('Download via blob failed, opening in new tab instead.', e);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const shareImage = useCallback(async (url: string) => {
    try {
      // Web Share API (mobile-friendly)
      const nav: any = navigator;
      if (nav?.share) {
        await nav.share({ title: 'Generated image', url });
        return;
      }
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(url);
      showNotification('Image link copied to clipboard!', 'success');
    } catch (e) {
      console.error('Share failed:', e);
      showNotification('Could not share automatically.', 'error');
    }
  }, [showNotification]);

  const saveGeneratedImageToAssets = useCallback(async () => {
    if (!uploadedImage) return;
    if (!user) {
      showNotification('Please sign in to save to Assets.', 'error');
      return;
    }
    if (hasSavedGeneratedImage) return;

    setIsSavingGeneratedImage(true);
    try {
      const ok = await saveImageToAssets(uploadedImage, textPrompt, 'text-to-image');
      if (ok) {
        setHasSavedGeneratedImage(true);
        showNotification('Image saved to assets!', 'success');
      } else {
        showNotification('Could not save to Assets. Please try again.', 'error');
      }
    } finally {
      setIsSavingGeneratedImage(false);
    }
  }, [uploadedImage, user, hasSavedGeneratedImage, saveImageToAssets, textPrompt, showNotification]);

  // Handle text-to-image generation
  const handleTextToImage = async () => {
    if (!textPrompt || !user) {
      showNotification('Please enter a prompt for your image', 'error');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress('Starting generation...');
    setUploadedImage(null);
    setBase64Image(null);
    setImageUrl(null);
    setShowGeneratedImageActions(false);
    setHasSavedGeneratedImage(false);

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

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate image generation');
      }

      if (data.imageUrl) {
        // Immediate result (rare)
        console.log('🎨 Immediate image result:', data.imageUrl);
        setUploadedImage(data.imageUrl);
        setBase64Image(data.imageUrl);
        setImageUrl(data.imageUrl);
        setIsGenerating(false);
        setGenerationProgress('');
        setShowGeneratedImageActions(true);
        setHasSavedGeneratedImage(false);
        return;
      }

      if (data.taskId) {
        const provider = data.provider || 'kie';
        console.log(`🎨 Started image generation with ${provider}, managing polling... Task ID: ${data.taskId}`);

        const startTime = Date.now();
        let attempts = 0;
        let finalImageUrl: string | null = null;

        const pollLoop = async () => {
          if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
            pollingTimeoutRef.current = null;
          }

          if (attempts >= MAX_RETRIES) {
            console.log(`⏰ Image generation timeout after ${MAX_RETRIES} attempts.`);
            console.log('💡 The image might still be generating. Check Kie.ai dashboard: https://kie.ai/logs');
            setIsGenerating(false);
            setGenerationProgress('');
            showNotification('Image generation timed out. It might still be processing.', 'error');
            return;
          }

          attempts++;
          const elapsed = Date.now() - startTime;
          const elapsedMinutes = Math.floor(elapsed / 60000);
          const elapsedSeconds = Math.round((elapsed % 60000) / 1000);
          const timeStr = elapsedMinutes > 0 ? `${elapsedMinutes}m ${elapsedSeconds}s` : `${elapsedSeconds}s`;
          setGenerationProgress(`Generating... ${timeStr} elapsed`);

          try {
            const pollData = await fetchImageStatus(data.taskId, provider);
            console.log('📊 Image poll response:', pollData);

            // Prioritize cached callback result if available
            if (pollData.source === 'cache' && pollData.imageUrl) {
              finalImageUrl = pollData.imageUrl;
              console.log('🎉 Found image in cache via polling!', finalImageUrl);
            } else if (pollData.status === 'COMPLETED' && pollData.imageUrl) {
              finalImageUrl = pollData.imageUrl;
              console.log('🎉 Found image via polling!', finalImageUrl);
            } else if (pollData.status === 'FAILED') {
              console.error('❌ Image generation failed:', pollData.error);
              showNotification(`Image generation failed: ${pollData.error || 'Unknown error'}`, 'error');
              setIsGenerating(false);
              setGenerationProgress('');
              return;
            }

            if (finalImageUrl) {
              setUploadedImage(finalImageUrl);
              setBase64Image(finalImageUrl);
              setImageUrl(finalImageUrl);
              setIsGenerating(false);
              setGenerationProgress('');
              setShowGeneratedImageActions(true);
              setHasSavedGeneratedImage(false);
              return;
            }
          } catch (pollingError) {
            console.error('Polling attempt failed:', pollingError);
          }

          // Schedule next poll
          pollingTimeoutRef.current = setTimeout(pollLoop, POLL_INTERVAL_MS);
        };

        // Start the polling loop
        pollingTimeoutRef.current = setTimeout(pollLoop, POLL_INTERVAL_MS); // Initial slight delay

      } else {
        showNotification('Generation started but no task ID received.', 'error');
        setIsGenerating(false);
      }
    } catch (error) {
      console.error('Text-to-image error:', error);
      showNotification('Failed to generate image. Please try again.', 'error');
      setIsGenerating(false);
      setGenerationProgress('');
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
            onClick={() => handleModeChange('image-to-video')}
            className={`px-4 py-2 font-semibold transition-colors ${activeMode === 'image-to-video'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-400 hover:text-white'
              }`}
          >
            IMAGE TO VIDEO
          </button>
          <button
            onClick={() => handleModeChange('text-to-video')}
            className={`px-4 py-2 font-semibold transition-colors flex items-center gap-2 ${activeMode === 'text-to-video'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-400 hover:text-white'
              }`}
          >
            <Sparkles className="w-4 h-4" />
            TEXT TO VIDEO
          </button>
          <button
            onClick={() => handleModeChange('text-to-image')}
            className={`px-4 py-2 font-semibold transition-colors flex items-center gap-2 ${activeMode === 'text-to-image'
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
                {generatedVideo ? (
                  <div className="w-full h-full relative bg-gray-800 rounded-lg overflow-hidden">
                    <video
                      src={generatedVideo}
                      className="w-full h-full object-cover"
                      controls
                      playsInline
                    />

                    <button
                      onClick={() => {
                        if (showGeneratedVideoActions) {
                          setShowGeneratedVideoActions(false);
                          setShowSocialShare(false);
                          return;
                        }
                        setGeneratedVideo(null);
                      }}
                      className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>

                    <button
                      onClick={() => setShowGeneratedVideoActions(true)}
                      className="absolute bottom-16 right-2 bg-black/60 hover:bg-black/75 rounded-full p-2 transition-colors"
                      aria-label="Open video actions"
                      title="Actions"
                    >
                      <Share2 className="w-4 h-4 text-white" />
                    </button>

                    {showGeneratedVideoActions && (
                      <div
                        className="absolute inset-0 bg-black/0 flex items-end"
                        onClick={() => setShowGeneratedVideoActions(false)}
                      >
                        <div
                          className="w-full bg-gray-900/95 border-t border-white/10 p-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setShowGeneratedVideoActions(false);
                              setShowSocialShare(false);
                            }}
                            className="absolute right-4 -top-10 bg-black/60 hover:bg-black/75 rounded-full p-2 transition-colors"
                            aria-label="Close details"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>

                          <div className="grid grid-cols-3 gap-3">
                            <button
                              onClick={() => setShowSocialShare(!showSocialShare)}
                              className={`transition-colors py-3 rounded-lg flex items-center justify-center ${showSocialShare ? 'bg-primary text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                              aria-label="Share"
                              title="Share"
                            >
                              <Share2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => downloadVideo(generatedVideo)}
                              className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center"
                              aria-label="Download"
                              title="Download"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                            <button
                              onClick={saveGeneratedVideoToAssets}
                              disabled={isSavingGeneratedVideo || hasSavedGeneratedVideo}
                              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center"
                              aria-label={hasSavedGeneratedVideo ? 'Saved' : 'Save to Assets'}
                              title={hasSavedGeneratedVideo ? 'Saved' : 'Save'}
                            >
                              {hasSavedGeneratedVideo ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                            </button>
                          </div>

                          {showSocialShare && (
                            <div className="flex justify-center gap-6 mt-6 pt-6 border-t border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                              <a
                                href={`https://t.me/share/url?url=${encodeURIComponent(generatedVideo)}&text=${encodeURIComponent('Check out my dance video from WaifuDance AI! 🐰🕺')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col items-center gap-1.5 group"
                              >
                                <div className="p-2.5 bg-[#0088cc]/10 group-hover:bg-[#0088cc]/20 rounded-full transition-colors">
                                  <svg className="w-5 h-5 fill-[#0088cc]" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.52-.45-.01-1.33-.26-1.98-.48-.8-.27-1.43-.42-1.37-.89.03-.25.38-.51 1.03-.78 4.04-1.76 6.74-2.92 8.09-3.48 3.85-1.6 4.64-1.88 5.17-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.19z" /></svg>
                                </div>
                                <span className="text-[10px] text-gray-400">Telegram</span>
                              </a>
                              <a
                                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(generatedVideo)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col items-center gap-1.5 group"
                              >
                                <div className="p-2.5 bg-[#1877F2]/10 group-hover:bg-[#1877F2]/20 rounded-full transition-colors">
                                  <svg className="w-5 h-5 fill-[#1877F2]" viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z" /></svg>
                                </div>
                                <span className="text-[10px] text-gray-400">Facebook</span>
                              </a>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(generatedVideo);
                                  showNotification('Link copied! Paste in TikTok to share.', 'success');
                                }}
                                className="flex flex-col items-center gap-1.5 group"
                              >
                                <div className="p-2.5 bg-white/10 group-hover:bg-white/20 rounded-full transition-colors">
                                  <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.86-.6-4.12-1.31a6.345 6.345 0 0 1-1.87-1.53c-.02 3.1-.03 6.19-.04 9.29-.08 1.8-.54 3.59-1.54 5.06-1.01 1.47-2.52 2.63-4.24 3.23-1.72.6-3.62.77-5.38.48-1.76-.29-3.41-1.12-4.72-2.35-1.31-1.23-2.19-2.85-2.5-4.63-.31-1.78-.07-3.64.65-5.31.72-1.68 1.94-3.14 3.49-4.1 1.55-.96 3.41-1.42 5.23-1.32 0 3.96 0 3.96 0 3.96-.54-.1-1.1-.07-1.63.09-.53.16-1.02.46-1.4.88-.38.42-.64.95-.75 1.51-.11.56-.05 1.14.18 1.66.23.52.61.96 1.09 1.25.48.29 1.04.43 1.6.41.56-.02 1.11-.2 1.58-.52.47-.32.84-.77 1.06-1.28.22-.51.3-1.08.3-1.65.01-4.11.02-8.21.03-12.31z" /></svg>
                                </div>
                                <span className="text-[10px] text-gray-400">TikTok</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : uploadedImage ? (
                  <div className="w-full h-full relative bg-gray-800 rounded-lg overflow-hidden">
                    <NextImage
                      src={base64Image || uploadedImage || ''}
                      alt="Your upload"
                      fill
                      unoptimized
                      className="object-cover"
                      onError={(e) => {
                        // If base64 fails, try GCP URL, then signed URL
                        const imgElement = e.currentTarget as HTMLImageElement;
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
                        setBase64Image(null);
                        setImageUrl(null);
                        setSelectedTemplate(null);
                        setGeneratedVideo(null);
                        setHasSavedGeneratedVideo(false);
                        setShowGeneratedVideoActions(false);
                        setShowTemplateHint(false);
                        setShowSocialShare(false);
                        // Also clear store state
                        setStoreTemplate(null);
                        setStoreUploadedImage(null);
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
              <div className={`w-full h-full flex flex-col ${generatedVideo ? 'p-0' : 'p-4'} gap-3`}>
                {generatedVideo ? (
                  <div className="w-full h-full relative">
                    <video
                      src={generatedVideo}
                      className="w-full h-full object-cover"
                      controls
                      playsInline
                    />
                    <button
                      onClick={() => {
                        if (showGeneratedVideoActions) {
                          setShowGeneratedVideoActions(false);
                          return;
                        }
                        setGeneratedVideo(null);
                        setTextPrompt('');
                        setHasSavedGeneratedVideo(false);
                      }}
                      className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>

                    {/* Small floating actions button near the bottom so it doesn't block video controls */}
                    <button
                      onClick={() => setShowGeneratedVideoActions(true)}
                      className="absolute bottom-16 right-2 bg-black/60 hover:bg-black/75 rounded-full p-2 transition-colors"
                      aria-label="Open video actions"
                      title="Actions"
                    >
                      <Share2 className="w-4 h-4 text-white" />
                    </button>

                    {showGeneratedVideoActions && (
                      <div
                        className="absolute inset-0 bg-black/0 flex items-end"
                        onClick={() => setShowGeneratedVideoActions(false)}
                      >
                        <div
                          className="w-full bg-gray-900/95 border-t border-white/10 p-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setShowGeneratedVideoActions(false)}
                            className="absolute right-4 -top-10 bg-black/60 hover:bg-black/75 rounded-full p-2 transition-colors"
                            aria-label="Close details"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>

                          <div className="grid grid-cols-3 gap-3">
                            <button
                              onClick={() => shareVideo(generatedVideo)}
                              className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center"
                              aria-label="Share"
                              title="Share"
                            >
                              <Share2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => downloadVideo(generatedVideo)}
                              className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center"
                              aria-label="Download"
                              title="Download"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                            <button
                              onClick={saveGeneratedVideoToAssets}
                              disabled={isSavingGeneratedVideo || hasSavedGeneratedVideo}
                              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center"
                              aria-label={hasSavedGeneratedVideo ? 'Saved' : 'Save to Assets'}
                              title={hasSavedGeneratedVideo ? 'Saved' : 'Save'}
                            >
                              {hasSavedGeneratedVideo ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            )}

            {/* Text-to-Image Mode: Show text area with preview */}
            {activeMode === 'text-to-image' && (
              <div className={`w-full h-full flex flex-col ${uploadedImage ? 'p-0' : 'p-4'} gap-3`}>
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
                        {generationProgress && (
                          <p className="text-white/70 text-xs mt-1">{generationProgress}</p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full relative">
                    <NextImage
                      src={uploadedImage || ''}
                      alt="Generated image"
                      fill
                      unoptimized
                      className="object-cover cursor-pointer"
                      onClick={() => setShowGeneratedImageActions(true)}
                    />
                    <button
                      onClick={() => {
                        if (showGeneratedImageActions) {
                          setShowGeneratedImageActions(false);
                          return;
                        }
                        // Clear preview (so user can regenerate)
                        setUploadedImage(null);
                        setTextPrompt('');
                        setHasSavedGeneratedImage(false);
                        setShowSocialShare(false);
                        // Also clear store state
                        setStoreUploadedImage(null);
                        setStoreTemplate(null);
                      }}
                      className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>

                    {/* Click image to open details/actions modal */}
                    {showGeneratedImageActions && (
                      <div
                        // Don't dim the image; just provide an invisible click-catcher + bottom sheet.
                        className="absolute inset-0 bg-black/0 flex items-end"
                        onClick={() => setShowGeneratedImageActions(false)}
                      >
                        <div
                          className="w-full bg-gray-900/95 border-t border-white/10 p-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Close icon pinned top-right of the sheet */}
                          <button
                            onClick={() => setShowGeneratedImageActions(false)}
                            className="absolute right-4 -top-10 bg-black/60 hover:bg-black/75 rounded-full p-2 transition-colors"
                            aria-label="Close details"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>

                          {/* Icon-only actions */}
                          <div className="grid grid-cols-3 gap-3">
                            <button
                              onClick={() => setShowSocialShare(!showSocialShare)}
                              className={`transition-colors py-3 rounded-lg flex items-center justify-center ${showSocialShare ? 'bg-primary text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                              aria-label="Share"
                              title="Share"
                            >
                              <Share2 className="w-5 h-5" />
                            </button>

                            <button
                              onClick={() => downloadImage(uploadedImage)}
                              className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center"
                              aria-label="Download"
                              title="Download"
                            >
                              <Download className="w-5 h-5" />
                            </button>

                            <button
                              onClick={saveGeneratedImageToAssets}
                              disabled={isSavingGeneratedImage || hasSavedGeneratedImage}
                              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center"
                              aria-label={hasSavedGeneratedImage ? 'Saved' : 'Save to Assets'}
                              title={hasSavedGeneratedImage ? 'Saved' : 'Save'}
                            >
                              {hasSavedGeneratedImage ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                            </button>
                          </div>

                          {showSocialShare && (
                            <div className="flex justify-center gap-6 mt-6 pt-6 border-t border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                              <a
                                href={`https://t.me/share/url?url=${encodeURIComponent(uploadedImage || '')}&text=${encodeURIComponent('Check out my creation from WaifuDance AI! 🐰🕺')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col items-center gap-1.5 group"
                              >
                                <div className="p-2.5 bg-[#0088cc]/10 group-hover:bg-[#0088cc]/20 rounded-full transition-colors">
                                  <svg className="w-5 h-5 fill-[#0088cc]" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.52-.45-.01-1.33-.26-1.98-.48-.8-.27-1.43-.42-1.37-.89.03-.25.38-.51 1.03-.78 4.04-1.76 6.74-2.92 8.09-3.48 3.85-1.6 4.64-1.88 5.17-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.19z" /></svg>
                                </div>
                                <span className="text-[10px] text-gray-400">Telegram</span>
                              </a>
                              <a
                                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(uploadedImage || '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col items-center gap-1.5 group"
                              >
                                <div className="p-2.5 bg-[#1877F2]/10 group-hover:bg-[#1877F2]/20 rounded-full transition-colors">
                                  <svg className="w-5 h-5 fill-[#1877F2]" viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z" /></svg>
                                </div>
                                <span className="text-[10px] text-gray-400">Facebook</span>
                              </a>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(uploadedImage || '');
                                  showNotification('Link copied! Paste in TikTok to share.', 'success');
                                }}
                                className="flex flex-col items-center gap-1.5 group"
                              >
                                <div className="p-2.5 bg-white/10 group-hover:bg-white/20 rounded-full transition-colors">
                                  <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.86-.6-4.12-1.31a6.345 6.345 0 0 1-1.87-1.53c-.02 3.1-.03 6.19-.04 9.29-.08 1.8-.54 3.59-1.54 5.06-1.01 1.47-2.52 2.63-4.24 3.23-1.72.6-3.62.77-5.38.48-1.76-.29-3.41-1.12-4.72-2.35-1.31-1.23-2.19-2.85-2.5-4.63-.31-1.78-.07-3.64.65-5.31.72-1.68 1.94-3.14 3.49-4.1 1.55-.96 3.41-1.42 5.23-1.32 0 3.96 0 3.96 0 3.96-.54-.1-1.1-.07-1.63.09-.53.16-1.02.46-1.4.88-.38.42-.64.95-.75 1.51-.11.56-.05 1.14.18 1.66.23.52.61.96 1.09 1.25.48.29 1.04.43 1.6.41.56-.02 1.11-.2 1.58-.52.47-.32.84-.77 1.06-1.28.22-.51.3-1.08.3-1.65.01-4.11.02-8.21.03-12.31z" /></svg>
                                </div>
                                <span className="text-[10px] text-gray-400">TikTok</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Selected Template Preview in Left Corner - Only for image-to-video mode */}
            {activeMode === 'image-to-video' && selectedTemplate && !generatedVideo && (
              <div className="absolute top-2 left-2 w-20 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-primary z-50 shadow-lg">
                <div className="absolute top-0 left-0 right-0 bg-primary text-white px-1 py-0.5 text-[6px] font-semibold text-center z-10">
                  Template
                </div>
                {selectedTemplate.previewVideo && videoUrls[selectedTemplate.id] ? (
                  <video
                    src={videoUrls[selectedTemplate.id]}
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
            {activeMode === 'image-to-video' && selectedTemplate && uploadedImage && !generatedVideo && (
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

        {/* Template Selection Hint */}
        {showTemplateHint && activeMode === 'image-to-video' && !selectedTemplate && (
          <div className="flex justify-center -mt-2 mb-4 animate-bounce">
            <div className="bg-primary/90 text-white px-6 py-2 rounded-full shadow-lg border border-white/20 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-bold uppercase tracking-wider">Now select a dance template below!</span>
            </div>
          </div>
        )}

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
                  className={`px-4 py-2 rounded-full text-sm transition-colors ${selectedCategory === cat.value
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
                  onClick={() => (uploadedImage || base64Image) && handleTemplateSelect(template)}
                  className={`relative aspect-[9/16] bg-gray-800 rounded-lg overflow-hidden transition-all group ${(uploadedImage || base64Image)
                    ? `cursor-pointer hover:scale-105 ${selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''}`
                    : 'cursor-not-allowed opacity-50'
                    }`}
                >
                  {template.previewVideo && videoUrls[template.id] ? (
                    <video
                      src={videoUrls[template.id]}
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

                  {/* Template Name Overlay - Always visible */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 pt-8">
                    <p className="text-white text-sm font-semibold drop-shadow-lg">{template.name}</p>
                    <p className="text-gray-300 text-xs mt-0.5 line-clamp-2 drop-shadow">{template.description}</p>
                  </div>

                  {/* Apply/Upgrade Hover Button */}
                  {(uploadedImage || base64Image) && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 backdrop-blur-[2px] z-20">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (template.id === 'kneel-and-crawl') {
                            window.location.href = 'https://buy.stripe.com/test_placeholder';
                          } else {
                            handleTemplateSelect(template);
                            // Scroll to top to show the generate button
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                        className="bg-primary hover:bg-primary-dark text-white text-[10px] sm:text-xs font-bold py-2 sm:py-2.5 px-3 sm:px-4 rounded-full flex items-center gap-1.5 shadow-2xl transform translate-y-2 group-hover:translate-y-0 transition-all duration-300"
                      >
                        <Sparkles className="w-3.5 h-3.5 fill-white" />
                        {template.id === 'kneel-and-crawl' ? 'Upgrade to Apply' : 'Apply to my picture'}
                      </button>
                    </div>
                  )}

                  {/* Selected Indicator */}
                  {selectedTemplate?.id === template.id && (
                    <div className="absolute top-2 right-2 bg-primary text-white px-2 py-1 rounded-full text-[8px] font-extrabold uppercase tracking-tighter shadow-lg z-30 animate-pulse">
                      Active
                    </div>
                  )}
                </div>
              ))}
            </div>

          </div>
        )}
      </div>

      {/* Global Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md"
          >
            <div className={`
              px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center gap-4
              ${notification.type === 'error'
                ? 'bg-red-500/90 border-red-400/50 text-white'
                : 'bg-green-500/90 border-green-400/50 text-white'}
            `}>
              <div className="bg-white/20 p-2 rounded-full">
                {notification.type === 'error' ? <AlertCircle className="w-5 h-5 text-white" /> : <Sparkles className="w-5 h-5 text-white" />}
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm uppercase tracking-tight">
                  {notification.type === 'error' ? 'Something went wrong' : 'Success'}
                </p>
                <p className="text-xs opacity-90 font-medium">{notification.message}</p>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="hover:bg-white/10 p-1.5 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
