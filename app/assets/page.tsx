'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import VideoPlayer from '@/components/VideoPlayer';
import { useUser } from '@/hooks/useUser';
import { getUserVideos, deleteVideo, getUserImages, deleteImage } from '@/lib/firestore';
import { GeneratedVideo, GeneratedImage } from '@/types';
import { Download, Trash2, Share2, Image as ImageIcon } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';

import { useStore } from '@/store/useStore';

type AssetType = 'all' | 'video' | 'image';

export default function AssetsPage() {
  const { user, isLoading: userLoading } = useUser();
  const { videos, setVideos, images, setImages } = useStore();
  const [activeTab, setActiveTab] = useState<AssetType>('all');
  const [isLoading, setIsLoading] = useState(true); // Always start with loading true

  const loadAssets = async () => {
    if (!user) {
      // Clear assets if no user
      setVideos([]);
      setImages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Always load from Firestore (user-based storage)
      const [userVideos, userImages] = await Promise.all([
        getUserVideos(user.id),
        getUserImages(user.id)
      ]);
      // Update store for UI reactivity, but these are NOT persisted to localStorage
      setVideos(userVideos);
      setImages(userImages);
    } catch (error) {
      console.error('Error loading assets:', error);
      // Clear assets on error
      setVideos([]);
      setImages([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Always reload assets when user changes
    if (!userLoading) {
      loadAssets();
    }
  }, [user?.id, userLoading]); // Reload when user ID changes

  const handleDownload = (videoUrl: string, videoId: string) => {
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `waifudance-${videoId}.mp4`;
    link.click();
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video?')) return;

    try {
      await deleteVideo(videoId);
      setVideos(videos.filter(v => v.id !== videoId));
    } catch (error) {
      console.error('Error deleting video:', error);
      alert('Failed to delete video');
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      await deleteImage(imageId);
      setImages(images.filter(i => i.id !== imageId));
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Failed to delete image');
    }
  };

  const handleDownloadImage = (imageUrl: string, imageId: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `waifudance-image-${imageId}.png`;
    link.click();
  };

  const handleShare = async (url: string, type: 'video' | 'image', title?: string) => {
    const shareData = {
      title: title || 'WaifuDance AI',
      text: `Check out this ${type} generated with WaifuDance AI!`,
      url: url,
    };

    // Try native share API first
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled or error occurred
        console.log('Share cancelled or failed');
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    } catch (err) {
      // Final fallback: show URL
      prompt('Copy this link:', url);
    }
  };

  const renderTagPills = (tags: string[]) => {
    if (!tags || tags.length === 0) return null;
    const unique = Array.from(new Set(tags)).slice(0, 4);
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {unique.map((t) => (
          <span
            key={t}
            className="px-4 py-2 rounded-full text-sm bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors select-none"
          >
            {t}
          </span>
        ))}
      </div>
    );
  };

  // Filter assets based on active tab
  const filteredVideos = activeTab === 'all' || activeTab === 'video' ? videos : [];
  const filteredImages = activeTab === 'all' || activeTab === 'image' ? images : [];
  const hasAssets = filteredVideos.length > 0 || filteredImages.length > 0;

  return (
    <Layout
      showBackButton
      backLabel="Assets"
      tabs={[
        { label: 'All', value: 'all' },
        { label: 'Videos', value: 'video' },
        { label: 'Images', value: 'image' }
      ]}
      activeTab={activeTab}
      onTabChange={(tab) => setActiveTab(tab as AssetType)}
    >
      <div className="p-4 sm:p-6">
        {isLoading || userLoading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" text="Loading assets..." />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {!hasAssets ? (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-400 text-lg">No assets yet</p>
                <p className="text-gray-500 text-sm mt-2">
                  Generate your first video or image to see it here
                </p>
              </div>
            ) : (
              <>
                {/* Videos */}
                {filteredVideos.map((video) => (
                  <div key={video.id} className="space-y-2">
                    <VideoPlayer
                      videoUrl={video.videoUrl}
                      thumbnail={video.thumbnail}
                      isWatermarked={video.isWatermarked}
                    />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{video.templateName}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(video.createdAt).toLocaleDateString()}
                        </p>
                        {renderTagPills(video.tags && video.tags.length ? video.tags : ['video', 'text-to-video'])}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleShare(video.videoUrl, 'video', video.templateName)}
                          className="p-2 bg-gray-800 hover:bg-blue-600 rounded-lg transition-colors"
                          title="Share"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(video.videoUrl, video.id)}
                          className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteVideo(video.id)}
                          className="p-2 bg-gray-800 hover:bg-red-600 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Images */}
                {filteredImages.map((image) => (
                  <div key={image.id} className="space-y-2">
                    <div className="relative aspect-[9/16] bg-gray-900 rounded-lg overflow-hidden group">
                      <img
                        src={image.imageUrl}
                        alt={image.prompt || 'Generated image'}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs border border-slate-700 bg-gray-800/80 text-gray-200 flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          image
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {image.prompt || 'Generated Image'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(image.createdAt).toLocaleDateString()}
                        </p>
                        {renderTagPills(
                          image.tags && image.tags.length
                            ? image.tags
                            : ['image', image.source || 'text-to-image']
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleShare(image.imageUrl, 'image', image.prompt)}
                          className="p-2 bg-gray-800 hover:bg-blue-600 rounded-lg transition-colors"
                          title="Share"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadImage(image.imageUrl, image.id)}
                          className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteImage(image.id)}
                          className="p-2 bg-gray-800 hover:bg-red-600 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

