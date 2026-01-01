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

  async function fileToDataUrl(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error || new Error('Failed to read file'));
      r.readAsDataURL(f);
    });
  }

  /**
   * Kie.ai rejects very large images ("Images size exceeds limit").
   * To make uploads reliable, we downscale + JPEG-compress in the browser before uploading to GCS.
   *
   * IMPORTANT: Kie/Veo validation can also fail when the reference image aspect ratio does not
   * match the requested `aspectRatio`. Our image-to-video path uses portrait (9:16), so we
   * center-crop to 9:16 before encoding to keep the input consistently valid.
   */
  async function preprocessImageForUpload(original: File): Promise<File> {
    // Only preprocess images.
    if (!original.type.startsWith('image/')) return original;

    // These limits are intentionally conservative to satisfy Kie.ai's "Images size exceeds limit".
    // We optimize for reliability over absolute quality.
    // Target a strict portrait 9:16 frame. Keep it small to satisfy hidden backend limits.
    const TARGET_ASPECT = 9 / 16; // width / height
    const TARGET_HEIGHT_START = 640; // results in ~360x640
    const MIN_HEIGHT = 512; // results in ~288x512
    const MIN_DIM = 512;
    const TARGET_MAX_BYTES = 350_000; // ~0.35MB

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      const url = URL.createObjectURL(original);
      el.onload = () => {
        URL.revokeObjectURL(url);
        resolve(el);
      };
      el.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to decode image'));
      };
      el.src = url;
    });

    const w = img.naturalWidth || (img as any).width;
    const h = img.naturalHeight || (img as any).height;
    if (!w || !h) return original;

    console.info('[upload] original image', {
      name: original.name,
      type: original.type,
      bytes: original.size,
      width: w,
      height: h,
    });

    let targetH = TARGET_HEIGHT_START;
    let quality = 0.78;

    // Try a few rounds: downscale, then reduce quality if still too big.
    for (let attempt = 0; attempt < 7; attempt++) {
      const outH = Math.max(1, Math.round(targetH));
      const outW = Math.max(1, Math.round(outH * TARGET_ASPECT));

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return original;

      // Center-crop source to 9:16 then scale into the output canvas.
      const srcAspect = w / h;
      let srcCropW = w;
      let srcCropH = h;
      let sx = 0;
      let sy = 0;

      if (srcAspect > TARGET_ASPECT) {
        // too wide -> crop width
        srcCropW = Math.round(h * TARGET_ASPECT);
        sx = Math.round((w - srcCropW) / 2);
      } else if (srcAspect < TARGET_ASPECT) {
        // too tall -> crop height
        srcCropH = Math.round(w / TARGET_ASPECT);
        sy = Math.round((h - srcCropH) / 2);
      }

      ctx.drawImage(img, sx, sy, srcCropW, srcCropH, 0, 0, outW, outH);

      // Encode JPEG at current quality
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))),
          'image/jpeg',
          quality
        );
      });

      if (blob.size <= TARGET_MAX_BYTES) {
        const newName = original.name.replace(/\.[^.]+$/, '') + '.jpg';
        console.info('[upload] processed image OK', {
          name: newName,
          type: 'image/jpeg',
          bytes: blob.size,
          width: outW,
          height: outH,
          quality,
          targetH,
        });
        return new File([blob], newName, { type: 'image/jpeg' });
      }

      // Too big: first reduce quality, then if already low quality, reduce dimensions further.
      if (quality > 0.45) {
        quality = Math.max(0.45, quality - 0.1);
      } else {
        targetH = Math.max(MIN_HEIGHT, Math.floor(targetH * 0.9));
      }
    }

    // Last resort: return whatever we have at the smallest settings.
    // (We should almost never reach here.)
    const outH = Math.max(1, MIN_HEIGHT);
    const outW = Math.max(1, Math.round(outH * TARGET_ASPECT));
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;

    const srcAspect = w / h;
    let srcCropW = w;
    let srcCropH = h;
    let sx = 0;
    let sy = 0;

    if (srcAspect > TARGET_ASPECT) {
      srcCropW = Math.round(h * TARGET_ASPECT);
      sx = Math.round((w - srcCropW) / 2);
    } else if (srcAspect < TARGET_ASPECT) {
      srcCropH = Math.round(w / TARGET_ASPECT);
      sy = Math.round((h - srcCropH) / 2);
    }

    ctx.drawImage(img, sx, sy, srcCropW, srcCropH, 0, 0, outW, outH);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))),
        'image/jpeg',
        0.45
      );
    });
    const newName = original.name.replace(/\.[^.]+$/, '') + '.jpg';
    console.info('[upload] processed image (last resort)', {
      name: newName,
      type: 'image/jpeg',
      bytes: blob.size,
      width: outW,
      height: outH,
      quality: 0.45,
      maxDim: MIN_HEIGHT,
    });
    return new File([blob], newName, { type: 'image/jpeg' });
  }

  // Restore preview from store if it exists
  useEffect(() => {
    if (uploadedImage) {
      setPreview(uploadedImage);
    }
  }, [uploadedImage]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file || !user) return;

    // Preprocess (downscale/compress) to avoid Kie.ai "Images size exceeds limit"
    // and to reduce upload size.
    let uploadFile: File = file;
    try {
      uploadFile = await preprocessImageForUpload(file);
    } catch (e) {
      console.warn('Image preprocess failed, using original file:', e);
      uploadFile = file;
    }

    // Show preview immediately and get base64 (use processed file so preview matches what we upload)
    const base64Promise = fileToDataUrl(uploadFile).then((result) => {
        setPreview(result); // Show base64 immediately
        setBase64Fallback(result); // Keep base64 as fallback
      return result;
    });

    // Upload to GCS (preferred): signed URL + direct PUT from browser.
    // This avoids Vercel serverless body limits (413 FUNCTION_PAYLOAD_TOO_LARGE).
    setIsUploading(true);
    try {
      const base64Data = await base64Promise;

      // 1) Get signed upload URL
      const sigRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          contentType: uploadFile.type,
          fileName: uploadFile.name,
          folder: 'images',
        }),
      });

      const sigText = await sigRes.text();
      let sigData: any = null;
      try {
        sigData = sigText ? JSON.parse(sigText) : null;
      } catch {
        sigData = null;
      }

      if (!sigRes.ok || !sigData?.uploadUrl || !sigData?.publicUrl) {
        console.error('Failed to get signed upload URL:', sigRes.status, sigText);
        // Fallback to legacy /api/upload for small files (may 413 on Vercel for larger images)
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('userId', user.id);
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        const rawText = await response.text();
        let data: any = null;
        try {
          data = rawText ? JSON.parse(rawText) : null;
        } catch {
          data = null;
        }
        if (response.ok && data?.imageUrl) {
          setUploadedImage(data.imageUrl);
          setPreview(data.imageUrl);
          onImageSelect({ gcpUrl: data.imageUrl, base64Url: base64Data });
          return;
        }
        console.error('Legacy upload failed:', response.status, rawText);
        onImageSelect({ gcpUrl: '', base64Url: base64Data });
        return;
      }

      // 2) PUT file directly to GCS
      const putRes = await fetch(sigData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': uploadFile.type },
        body: uploadFile,
      });

      if (!putRes.ok) {
        const putText = await putRes.text();
        console.error('Direct upload failed:', putRes.status, putText);
        onImageSelect({ gcpUrl: '', base64Url: base64Data });
        return;
      }

      // 3) Use public URL for generation
      setUploadedImage(sigData.publicUrl);
      setPreview(sigData.publicUrl);
      onImageSelect({ gcpUrl: sigData.publicUrl, base64Url: base64Data });
    } catch (error) {
      console.error('Upload error:', error);
      // Keep the base64 preview even if upload fails
      const base64Data = await base64Promise;
      onImageSelect({ gcpUrl: '', base64Url: base64Data });
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

