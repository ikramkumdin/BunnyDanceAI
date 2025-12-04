'use client';

import { useState, useRef } from 'react';
import { Play, Pause, Download, RotateCcw } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string;
  thumbnail?: string;
  onRetry?: () => void;
  onSave?: () => void;
  isWatermarked?: boolean;
}

export default function VideoPlayer({ 
  videoUrl, 
  thumbnail, 
  onRetry, 
  onSave,
  isWatermarked = false 
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  return (
    <div className="relative aspect-[9/16] bg-gray-900 rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        src={videoUrl}
        poster={thumbnail}
        className="w-full h-full object-cover"
        loop
        onLoadedData={() => setIsLoading(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      )}
      
      <button
        onClick={togglePlay}
        className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors"
      >
        {!isPlaying && (
          <div className="bg-white/90 rounded-full p-4">
            <Play className="w-8 h-8 text-gray-900 fill-gray-900" />
          </div>
        )}
      </button>
      
      {isWatermarked && (
        <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
          Watermarked
        </div>
      )}
      
      {onRetry && onSave && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 px-4">
          <button
            onClick={onRetry}
            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Retry
          </button>
          <button
            onClick={onSave}
            className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Save
          </button>
        </div>
      )}
    </div>
  );
}



