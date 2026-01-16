'use client';

import { useState, useRef } from 'react';
import { X, Heart, RotateCcw, Download, Play, Pause } from 'lucide-react';

interface FullScreenVideoModalProps {
  videoUrl: string;
  isOpen: boolean;
  onClose: () => void;
  onRetry?: () => void;
  onDownload?: () => void;
  onLike?: () => void;
  isLiked?: boolean;
}

export default function FullScreenVideoModal({
  videoUrl,
  isOpen,
  onClose,
  onRetry,
  onDownload,
  onLike,
  isLiked = false,
}: FullScreenVideoModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (!isOpen) return null;

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `waifudance-${Date.now()}.mp4`;
      link.click();
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
      >
        <X className="w-8 h-8" />
      </button>

      <div className="relative w-full h-full flex items-center justify-center">
        <video
          ref={videoRef}
          src={videoUrl}
          className="max-w-full max-h-full object-contain"
          loop
          onLoadedData={() => setIsLoading(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          autoPlay
        />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white"></div>
          </div>
        )}

        {!isPlaying && !isLoading && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors"
          >
            <div className="bg-white/90 rounded-full p-6">
              <Play className="w-12 h-12 text-gray-900 fill-gray-900" />
            </div>
          </button>
        )}
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-6">
        <button
          onClick={onLike}
          className={`flex flex-col items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            isLiked
              ? 'text-accent'
              : 'text-white hover:text-gray-300'
          }`}
        >
          <Heart className={`w-6 h-6 ${isLiked ? 'fill-accent' : ''}`} />
          <span className="text-xs">Like</span>
        </button>

        {onRetry && (
          <button
            onClick={onRetry}
            className="flex flex-col items-center gap-2 px-4 py-2 rounded-lg text-white hover:text-gray-300 transition-colors"
          >
            <RotateCcw className="w-6 h-6" />
            <span className="text-xs">Retry</span>
          </button>
        )}

        <button
          onClick={handleDownload}
          className="flex flex-col items-center gap-2 px-4 py-2 rounded-lg text-white hover:text-gray-300 transition-colors"
        >
          <Download className="w-6 h-6" />
          <span className="text-xs">Download</span>
        </button>
      </div>
    </div>
  );
}



