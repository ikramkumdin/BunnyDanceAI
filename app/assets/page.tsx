'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import VideoPlayer from '@/components/VideoPlayer';
import { useUser } from '@/hooks/useUser';
import { getUserVideos, deleteVideo, getUserImages, deleteImage } from '@/lib/firestore';
import { GeneratedVideo, GeneratedImage } from '@/types';
import { Download, Trash2, Image as ImageIcon } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';

type AssetType = 'all' | 'video' | 'image';

export default function AssetsPage() {
  const { user, isLoading: userLoading } = useUser();
  const [activeTab, setActiveTab] = useState<AssetType>('all');
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && !userLoading) {
      loadAssets();
    }
  }, [user, userLoading]);

  const loadAssets = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const [userVideos, userImages] = await Promise.all([
        getUserVideos(user.id),
        getUserImages(user.id)
      ]);
      setVideos(userVideos);
      setImages(userImages);
    } catch (error) {
      console.error('Error loading assets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (videoUrl: string, videoId: string) => {
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `bunny-dance-${videoId}.mp4`;
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
    link.download = `bunny-dance-image-${imageId}.png`;
    link.click();
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
      <div className="p-6">
        {isLoading || userLoading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" text="Loading assets..." />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                      </div>
                      <div className="flex gap-2">
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
                      <div className="absolute top-2 left-2 bg-primary/80 text-white px-2 py-1 rounded text-xs font-semibold">
                        Image
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
                        {image.source && (
                          <p className="text-xs text-gray-600 mt-1">
                            {image.source === 'text-to-image' ? 'Text-to-Image' : 'Image-to-Video'}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
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

