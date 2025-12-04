// Utility functions

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Please upload PNG, JPG, or WEBP.' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 10MB limit.' };
  }

  return { valid: true };
}

export function addWatermark(videoUrl: string): string {
  // In production, this would add a watermark overlay to the video
  // For now, return the original URL
  return videoUrl;
}

export function generateVideoId(): string {
  return `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}



