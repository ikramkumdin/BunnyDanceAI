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
    const failedLines = [];

    try {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        try {
          // Parse taskId=url format
          const [taskId, url] = line.split('=');
          if (!taskId || !url) {
            console.error(`Line ${i + 1}: Invalid format: ${line}. Use: taskId=url`);
            failedLines.push(`Line ${i + 1}: Invalid format`);
            failCount++;
            continue;
          }

          const cleanTaskId = taskId.trim();
          const cleanUrl = url.trim();

          // Validate URL
          if (!cleanUrl.startsWith('http')) {
            console.error(`Line ${i + 1}: Invalid URL: ${cleanUrl}`);
            failedLines.push(`Line ${i + 1}: Invalid URL`);
            failCount++;
            continue;
          }

          console.log(`Importing line ${i + 1}: ${cleanTaskId} → ${cleanUrl}`);

          // Sync to cache first
          const cacheResponse = await fetch('/api/sync-image-result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId: cleanTaskId,
              imageUrl: cleanUrl,
              status: 'SUCCESS'
            })
          });

          if (!cacheResponse.ok) {
            const errorText = await cacheResponse.text();
            console.error(`Line ${i + 1}: Cache sync failed:`, errorText);
            failedLines.push(`Line ${i + 1}: Cache sync failed`);
            failCount++;
            continue;
          }

          // Save to assets
          await saveImage({
            userId: user.id,
            imageUrl: cleanUrl,
            prompt: `Imported from Kie.ai (${cleanTaskId})`,
            source: 'text-to-image',
            tags: ['photo', 'text-to-image', 'imported'],
            type: 'image',
            createdAt: new Date().toISOString(),
          });

          console.log(`✅ Successfully imported: ${cleanTaskId}`);
          successCount++;
        } catch (error) {
          console.error(`Line ${i + 1}: Error importing ${line}:`, error);
          failedLines.push(`Line ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          failCount++;
        }
      }

      // Reload assets
      await loadAssets();

      setShowImportDialog(false);
      setImportTaskIds('');

      let message = `Import complete!\n✅ Success: ${successCount}\n❌ Failed: ${failCount}`;

      if (failedLines.length > 0 && failedLines.length <= 5) {
        message += '\n\nFailed imports:\n' + failedLines.join('\n');
      } else if (failedLines.length > 5) {
        message += '\n\nToo many failures to list. Check console for details.';
      }

      alert(message);
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
              onClick={() => setShowImportDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              Import from Kie.ai Logs
            </button>
          </div>
        )}

        {/* Import Dialog */}
        {showImportDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Import Images from Kie.ai</h3>
              <p className="text-sm text-gray-400 mb-4">
                Paste your task IDs and URLs from Kie.ai logs (format: taskId=url, one per line).
                <br />
                <strong>Get URLs from:</strong> https://kie.ai/logs → find your tasks → copy the image URLs.
              </p>
              <button
                onClick={() => {
                  // Pre-fill with task IDs from user's logs
                  setImportTaskIds(`1c974e84eaefc545a5adb7d771ee8d2c=\n${importTaskIds}`);
                }}
                className="mb-3 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
              >
                Pre-fill Task IDs
              </button>
              <textarea
                value={importTaskIds}
                onChange={(e) => setImportTaskIds(e.target.value)}
                placeholder={`1c974e84eaefc545a5adb7d771ee8d2c=https://tempfile.aiquickdraw.com/s/your-actual-image-url.png\nc92a7430340aa131e54a2e9aadf65487=https://tempfile.aiquickdraw.com/s/another-url.png`}
                className="w-full h-40 bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-white font-mono resize-none"
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

