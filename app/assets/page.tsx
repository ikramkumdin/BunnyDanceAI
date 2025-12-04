'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import VideoPlayer from '@/components/VideoPlayer';
import { useUser } from '@/hooks/useUser';
import { getUserVideos, deleteVideo } from '@/lib/firestore';
import { GeneratedVideo } from '@/types';
import { Download, Trash2 } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function AssetsPage() {
  const { user, isLoading: userLoading } = useUser();
  const [activeTab, setActiveTab] = useState<'videos' | 'images'>('videos');
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && !userLoading) {
      loadVideos();
    }
  }, [user, userLoading]);

  const loadVideos = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const userVideos = await getUserVideos(user.id);
      setVideos(userVideos);
    } catch (error) {
      console.error('Error loading videos:', error);
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

  const handleDelete = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video?')) return;
    
    try {
      await deleteVideo(videoId);
      setVideos(videos.filter(v => v.id !== videoId));
    } catch (error) {
      console.error('Error deleting video:', error);
      alert('Failed to delete video');
    }
  };

  return (
    <Layout 
      showBackButton 
      backLabel="Assets"
      tabs={[
        { label: 'Videos', value: 'videos' },
        { label: 'Images', value: 'images' }
      ]}
      activeTab={activeTab}
      onTabChange={(tab) => setActiveTab(tab as 'videos' | 'images')}
    >
      <div className="p-6">
        {activeTab === 'videos' ? (
          isLoading || userLoading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner size="lg" text="Loading videos..." />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-400 text-lg">No videos yet</p>
                <p className="text-gray-500 text-sm mt-2">
                  Generate your first video to see it here
                </p>
              </div>
            ) : (
              videos.map((video) => (
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
                        onClick={() => handleDelete(video.id)}
                        className="p-2 bg-gray-800 hover:bg-red-600 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
              )}
            </div>
          )
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">Images coming soon</p>
          </div>
        )}
      </div>
    </Layout>
  );
}

