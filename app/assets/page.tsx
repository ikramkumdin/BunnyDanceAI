'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import VideoPlayer from '@/components/VideoPlayer';
import { useUser } from '@/hooks/useUser';
import { getUserVideos, deleteVideo, getUserImages, deleteImage, saveImage } from '@/lib/firestore';
import { GeneratedVideo, GeneratedImage } from '@/types';
import { Download, Trash2, Image as ImageIcon, Share2, Plus, Loader2 } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';


type AssetType = 'all' | 'video' | 'image';

export default function AssetsPage() {
  const { user, isLoading: userLoading } = useUser();
  const [activeTab, setActiveTab] = useState<AssetType>('all');
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importTaskIds, setImportTaskIds] = useState('');

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

  useEffect(() => {
    if (user && !userLoading) {
      loadAssets();
    }
  }, [user, userLoading]);

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

  const handleShare = async (url: string, type: 'video' | 'image', title?: string) => {
    const shareData = {
      title: title || 'Bunny Dance AI',
      text: `Check out this ${type} generated with Bunny Dance AI!`,
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

  const handleImportImages = async () => {
    if (!user || !importTaskIds.trim()) return;

    const lines = importTaskIds
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      alert('Please enter task IDs in format: taskId=url (one per line)');
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const line of lines) {
        try {
          // Parse taskId=url format
          const [taskId, url] = line.split('=');
          if (!taskId || !url) {
            console.error(`Invalid format: ${line}. Use: taskId=url`);
            failCount++;
            continue;
          }

          // Sync to cache first
          await fetch('/api/sync-image-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId: taskId.trim(),
              imageUrl: url.trim(),
              status: 'SUCCESS'
            })
          });

          // Save to assets
          await saveImage({
            userId: user.id,
            imageUrl: url.trim(),
            prompt: `Imported from Kie.ai (${taskId.trim()})`,
            source: 'text-to-image',
            tags: ['photo', 'text-to-image', 'imported'],
            type: 'image',
            createdAt: new Date().toISOString(),
          });

          successCount++;
        } catch (error) {
          console.error(`Error importing line ${line}:`, error);
          failCount++;
        }
      }

      // Reload assets
      await loadAssets();

      setShowImportDialog(false);
      setImportTaskIds('');

      alert(`Import complete!\n✅ Success: ${successCount}\n❌ Failed: ${failCount}`);
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import images. Please try again.');
    } finally {
      setIsImporting(false);
    }
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
        {/* Import Button */}
        {!isLoading && !userLoading && (
          <div className="mb-4 flex justify-end gap-2">
            <button
              onClick={async () => {
                // Direct import using the URLs from user's logs
                const imagesToImport = [
                  {
                    taskId: '1c974e84eaefc545a5adb7d771ee8d2c',
                    url: 'https://tempfile.aiquickdraw.com/s/1c974e84eaefc545a5adb7d771ee8d2c_0_1765360441_7280.png'
                  },
                  {
                    taskId: 'c92a7430340aa131e54a2e9aadf65487',
                    url: 'https://tempfile.aiquickdraw.com/s/c92a7430340aa131e54a2e9aadf65487_0_1765368148_3098.png'
                  },
                  {
                    taskId: '1a16c95b9e9f797bc2d1672a3829527a',
                    url: 'https://tempfile.aiquickdraw.com/s/1a16c95b9e9f797bc2d1672a3829527a_0_1765360444_7280.png'
                  },
                  {
                    taskId: '3119eb850808975c5436defe37fa54e0',
                    url: 'https://tempfile.aiquickdraw.com/s/3119eb850808975c5436defe37fa54e0_0_1765360447_7280.png'
                  },
                  {
                    taskId: '0d865455705d38bf86c81a81037edab2',
                    url: 'https://tempfile.aiquickdraw.com/s/0d865455705d38bf86c81a81037edab2_0_1765360449_7280.png'
                  },
                  {
                    taskId: '139392b865de6519fd837319ae6dd4eb',
                    url: 'https://tempfile.aiquickdraw.com/s/139392b865de6519fd837319ae6dd4eb_0_1765360452_7280.png'
                  }
                ];

                if (!user) return;

                setIsImporting(true);
                let successCount = 0;
                let failCount = 0;

                try {
                  for (const img of imagesToImport) {
                    try {
                      // Sync to cache first
                      await fetch('/api/sync-image-result', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          taskId: img.taskId,
                          imageUrl: img.url,
                          status: 'SUCCESS'
                        })
                      });

                      // Save to assets
                      await saveImage({
                        userId: user.id,
                        imageUrl: img.url,
                        prompt: `Imported from Kie.ai (${img.taskId})`,
                        source: 'text-to-image',
                        tags: ['photo', 'text-to-image', 'imported'],
                        type: 'image',
                        createdAt: new Date().toISOString(),
                      });

                      successCount++;
                    } catch (error) {
                      console.error(`Error importing task ${img.taskId}:`, error);
                      failCount++;
                    }
                  }

                  // Reload assets
                  await loadAssets();

                  alert(`Import complete!\n✅ Success: ${successCount}\n❌ Failed: ${failCount}`);
                } catch (error) {
                  console.error('Import error:', error);
                  alert('Failed to import images. Please try again.');
                } finally {
                  setIsImporting(false);
                }
              }}
              disabled={isImporting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-semibold"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Quick Import (All Logs)
                </>
              )}
            </button>
          </div>
        )}

        {/* Import Dialog */}
        {showImportDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Import Images from Kie.ai</h3>
              <p className="text-sm text-gray-400 mb-4">
                This dialog is for manual import. Use &quot;Quick Import (All Logs)&quot; button instead for automatic import.
              </p>
              <textarea
                value={importTaskIds}
                onChange={(e) => setImportTaskIds(e.target.value)}
                placeholder="1c974e84eaefc545a5adb7d771ee8d2c=https://tempfile.aiquickdraw.com/s/...&#10;c92a7430340aa131e54a2e9aadf65487=https://tempfile.aiquickdraw.com/s/..."
                className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-white font-mono resize-none"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleImportImages}
                  disabled={isImporting || !importTaskIds.trim()}
                  className="flex-1 bg-primary hover:bg-primary-dark disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    'Import'
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowImportDialog(false);
                    setImportTaskIds('');
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

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

