// Use GCP Storage instead of Firebase Storage
import * as gcpStorage from './gcp-storage';

/**
 * Upload an image file to GCP Cloud Storage
 * @param file - File object or base64 string
 * @param userId - User ID for organizing files
 * @param folder - Folder name (e.g., 'images', 'videos')
 * @returns Public URL
 */
export async function uploadImage(
  file: File | string,
  userId: string,
  folder: string = 'images'
): Promise<string> {
  return gcpStorage.uploadImage(file, userId, folder);
}

/**
 * Upload a video file to GCP Cloud Storage
 * @param file - File object or URL
 * @param userId - User ID for organizing files
 * @returns Public URL
 */
export async function uploadVideo(
  file: File | string,
  userId: string
): Promise<string> {
  return gcpStorage.uploadVideo(file, userId);
}

/**
 * Delete a file from GCP Cloud Storage
 * @param fileUrl - Full URL of the file to delete
 */
export async function deleteFile(fileUrl: string): Promise<void> {
  return gcpStorage.deleteFile(fileUrl);
}

// Re-export utility functions
export { getFileExtension } from './gcp-storage';

