'use client';

import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useUser } from '@/hooks/useUser';

interface PhotoUploadProps {
  onImageSelect: (imageData: { gcpUrl: string; base64Url: string }) => void;
  maxSize?: number; // in MB
}

export default function PhotoUpload({ onImageSelect, maxSize = 10 }: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [base64Fallback, setBase64Fallback] = useState<string | null>(null); // Keep base64 as fallback
  const [isUploading, setIsUploading] = useState(false);
  const { uploadedImage, setUploadedImage } = useStore();
  const { user } = useUser();

  // Restore preview from store if it exists
  useEffect(() => {
    if (uploadedImage) {
      setPreview(uploadedImage);
    }
  }, [uploadedImage]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file || !user) return;

    // Show preview immediately and get base64
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onload = () => {
        const result = reader.result as string;
        setPreview(result); // Show base64 immediately
        setBase64Fallback(result); // Keep base64 as fallback
        resolve(result);
      };
    });
    reader.readAsDataURL(file);

    // Upload to GCP Storage
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.imageUrl) {
        // Update to GCP URL after successful upload
        const gcpUrl = data.imageUrl;
        setUploadedImage(gcpUrl);
        setPreview(gcpUrl); // Try GCP URL first

        // Wait for base64 to be available before calling onImageSelect
        const base64Data = await base64Promise;
        onImageSelect({ gcpUrl, base64Url: base64Data });
      } else {
        // Keep base64 preview if upload fails
        console.error('Upload failed, keeping base64 preview');
        // Don't clear the preview - keep the base64 image
      }
    } catch (error) {
      console.error('Upload error:', error);
      // Keep the base64 preview even if upload fails
    } finally {
      setIsUploading(false);
    }
  }, [onImageSelect, setUploadedImage, user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    maxSize: maxSize * 1024 * 1024,
    multiple: false,
  });

  const removeImage = () => {
    setPreview(null);
    setBase64Fallback(null);
    setUploadedImage(null);
  };

  return (
    <div className="w-full h-full relative">
      {preview || uploadedImage ? (
        <div className="w-full h-full bg-gray-800 rounded-lg overflow-hidden">
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          )}
          <img
            src={preview || uploadedImage || base64Fallback || ''}
            alt="Upload preview"
            className="w-full h-full object-cover"
            onError={(e) => {
              // If GCP URL fails, try signed URL, then fallback to base64
              const imgElement = e.currentTarget;
              if (!imgElement) return;

              const currentSrc = imgElement.src;
              if (currentSrc.startsWith('https://storage.googleapis.com/')) {
                // Try to get signed URL
                fetch(`/api/get-signed-url?path=${encodeURIComponent(currentSrc)}`)
                  .then((res) => res.json())
                  .then((data) => {
                    if (imgElement && data.url) {
                      imgElement.src = data.url;
                    } else if (imgElement && base64Fallback) {
                      // Fallback to base64 if signed URL fails
                      imgElement.src = base64Fallback;
                    }
                  })
                  .catch(() => {
                    // Fallback to base64 if all else fails
                    if (imgElement && base64Fallback) {
                      imgElement.src = base64Fallback;
                    }
                  });
              } else if (imgElement && base64Fallback && currentSrc !== base64Fallback) {
                // If current src fails and we have base64, use it
                imgElement.src = base64Fallback;
              } else if (imgElement && !base64Fallback) {
                // Final fallback to placeholder
                imgElement.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="600"%3E%3Crect fill="%23333" width="400" height="600"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage not found%3C/text%3E%3C/svg%3E';
              }
            }}
          />
          <button
            onClick={removeImage}
            disabled={isUploading}
            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`w-full h-full border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors flex flex-col items-center justify-center ${
            isDragActive
              ? 'border-primary bg-primary/10'
              : 'border-gray-600 hover:border-gray-500 bg-gray-800'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-8 h-8 mb-2 text-gray-400" />
          <p className="text-gray-300 text-xs mb-1">
            {isDragActive ? 'Drop image' : 'Upload photo'}
          </p>
          <p className="text-xs text-gray-500">
            max {maxSize}MB
          </p>
        </div>
      )}
    </div>
  );
}

