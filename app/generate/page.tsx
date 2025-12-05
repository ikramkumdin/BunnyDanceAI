'use client';

import { useState, useCallback } from 'react';
import { templates } from '@/data/templates';
import { Template } from '@/types';
import { X, Search, Sparkles } from 'lucide-react';
import PhotoUpload from '@/components/PhotoUpload';
import { useStore } from '@/store/useStore';
import { useUser } from '@/hooks/useUser';
import Layout from '@/components/Layout';

export default function GeneratePage() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const { setSelectedTemplate: setStoreTemplate, setUploadedImage: setStoreUploadedImage } = useStore();
  const { user } = useUser();

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
      console.log('🔍 Checking video status...');
      const response = await fetch(`/api/check-video?userId=${user?.id}${taskId ? `&taskId=${taskId}` : ''}`);
      const data = await response.json();

      console.log('📊 Video check response:', data);

      if (data.ready && data.videoUrl) {
        console.log('🎬 Video ready:', data.videoUrl);
        setGeneratedVideo(data.videoUrl);
        setIsGenerating(false);
        return;
      }

      // Continue polling if not ready (max 15 minutes)
      const elapsed = Date.now() - startTime;
      const elapsedMinutes = Math.round(elapsed / (60 * 1000));
      console.log(`⏳ Polling... ${elapsedMinutes}/15 minutes elapsed`);

      if (elapsed < 15 * 60 * 1000) { // 15 minutes
        setTimeout(() => pollVideoStatus(startTime, taskId), 10000); // Check every 10 seconds
      } else {
        console.log('⏰ Video generation timeout after 15 minutes');
        setIsGenerating(false);
        alert('Video generation is taking longer than expected. The video may still complete - please refresh the page in a few minutes to check.');
      }
    } catch (error) {
      console.error('Polling error:', error);
      setIsGenerating(false);
      alert('Error checking video status. Please try again.');
    }
  }, [user?.id]);

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
        {/* Upload Area - Same size as templates, above tags */}
        <div className="flex justify-center">
          <div className="relative aspect-[9/16] w-80 bg-gray-800 rounded-lg overflow-hidden">
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

              {/* Selected Template Preview in Left Corner - Always visible when template selected */}
              {selectedTemplate && (
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

              {/* Generate Button Below Main Preview Area */}
              {selectedTemplate && uploadedImage && (
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

        {/* Template Selection - Always visible for browsing */}
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
      </div>
    </Layout>
  );
}
