import { Storage } from '@google-cloud/storage';

// Initialize GCP Storage client (server-side only)
let storageClient: Storage | null = null;

function getStorageClient(): Storage {
  if (typeof window !== 'undefined') {
    throw new Error('GCP Storage can only be used server-side. Use API routes instead.');
  }

  if (!storageClient) {
    // Use service account key from environment or default credentials
    let credentials;
    try {
      if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
        credentials = typeof process.env.GCP_SERVICE_ACCOUNT_KEY === 'string'
          ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
          : process.env.GCP_SERVICE_ACCOUNT_KEY;
      }
    } catch (error) {
      console.error('Error parsing GCP_SERVICE_ACCOUNT_KEY:', error);
    }

    storageClient = new Storage({
      projectId: process.env.GCP_PROJECT_ID || 'voice-app-d19d8',
      credentials,
      // If no credentials provided, will use default credentials from GCP
    });
  }
  return storageClient;
}

const BUCKET_NAME = process.env.GCP_STORAGE_BUCKET || 'voice-app-storage';

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
  try {
    const storage = getStorageClient();
    const bucket = storage.bucket(BUCKET_NAME);

    let fileBuffer: Buffer;
    let fileName: string;
    let mimeType: string;

    // Convert base64 to Buffer if needed
    if (typeof file === 'string') {
      const base64Data = file.includes(',') ? file.split(',')[1] : file;
      fileBuffer = Buffer.from(base64Data, 'base64');
      fileName = `image-${Date.now()}.jpg`;
      mimeType = 'image/jpeg';
    } else {
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      fileName = file.name;
      mimeType = file.type;
    }

    // Create file path
    const filePath = `${userId}/${folder}/${Date.now()}-${fileName}`;
    const fileRef = bucket.file(filePath);

    // Upload file (without ACL since uniform bucket-level access is enabled)
    await fileRef.save(fileBuffer, {
      metadata: {
        contentType: mimeType,
        cacheControl: 'public, max-age=31536000',
      },
      // Don't use 'public: true' - uniform bucket-level access doesn't support ACLs
    });

    // Get URL (will need signed URL if bucket is private)
    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${filePath}`;
    
    return publicUrl;
  } catch (error) {
    console.error('Error uploading image to GCP:', error);
    throw error;
  }
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
  try {
    const storage = getStorageClient();
    const bucket = storage.bucket(BUCKET_NAME);

    let fileBuffer: Buffer;
    let fileName: string;
    let mimeType: string = 'video/mp4';

    // If it's a URL, fetch and convert to Buffer
    if (typeof file === 'string') {
      const response = await fetch(file);
      const arrayBuffer = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      fileName = `video-${Date.now()}.mp4`;
      mimeType = response.headers.get('content-type') || 'video/mp4';
    } else {
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      fileName = file.name;
      mimeType = file.type;
    }

    // Create file path
    const filePath = `${userId}/videos/${Date.now()}-${fileName}`;
    const fileRef = bucket.file(filePath);

    // Upload file (without ACL since uniform bucket-level access is enabled)
    await fileRef.save(fileBuffer, {
      metadata: {
        contentType: mimeType,
        cacheControl: 'public, max-age=31536000',
      },
      // Don't use 'public: true' - uniform bucket-level access doesn't support ACLs
    });

    // Get URL (will need signed URL if bucket is private)
    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${filePath}`;
    
    return publicUrl;
  } catch (error) {
    console.error('Error uploading video to GCP:', error);
    throw error;
  }
}

/**
 * Delete a file from GCP Cloud Storage
 * @param fileUrl - Full URL of the file to delete
 */
export async function deleteFile(fileUrl: string): Promise<void> {
  try {
    const storage = getStorageClient();
    const bucket = storage.bucket(BUCKET_NAME);

    // Extract file path from URL
    const url = new URL(fileUrl);
    const filePath = url.pathname.replace(`/${BUCKET_NAME}/`, '');

    if (!filePath) {
      throw new Error('Invalid file URL');
    }

    const fileRef = bucket.file(filePath);
    await fileRef.delete();
  } catch (error) {
    console.error('Error deleting file from GCP:', error);
    throw error;
  }
}

/**
 * Get a signed URL for private file access (optional)
 * @param filePath - Path to the file in storage (can be full URL or relative path)
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 */
export async function getSignedUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const storage = getStorageClient();
    const bucket = storage.bucket(BUCKET_NAME);
    
    // Extract path from full URL if provided
    let gcsPath = filePath;
    if (filePath.startsWith('https://storage.googleapis.com/')) {
      const url = new URL(filePath);
      // Remove bucket name from path
      const pathParts = url.pathname.split('/').filter(p => p);
      if (pathParts[0] === BUCKET_NAME) {
        gcsPath = pathParts.slice(1).join('/');
      } else {
        gcsPath = url.pathname.substring(1); // Remove leading /
      }
    }
    
    const fileRef = bucket.file(gcsPath);

    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    });

    return url;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw error;
  }
}

/**
 * Get file extension from MIME type
 */
export function getFileExtension(mimeType: string): string {
  const extensions: { [key: string]: string } = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  };
  return extensions[mimeType] || 'jpg';
}

