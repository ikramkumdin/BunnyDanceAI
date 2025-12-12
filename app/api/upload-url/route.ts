import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { getFileExtension } from '@/lib/gcp-storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getStorageClient(): Storage {
  let credentials: any = undefined;
  try {
    if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
      credentials =
        typeof process.env.GCP_SERVICE_ACCOUNT_KEY === 'string'
          ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
          : process.env.GCP_SERVICE_ACCOUNT_KEY;
    }
  } catch (e) {
    console.error('Error parsing GCP_SERVICE_ACCOUNT_KEY:', e);
  }

  return new Storage({
    projectId: process.env.GCP_PROJECT_ID || 'voice-app-d19d8',
    credentials,
  });
}

export async function POST(request: NextRequest) {
  try {
    const { userId, contentType, fileName, folder } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (!contentType || typeof contentType !== 'string') {
      return NextResponse.json({ error: 'contentType is required' }, { status: 400 });
    }

    const bucketName = process.env.GCP_STORAGE_BUCKET || 'voice-app-storage';
    const ext = getFileExtension(contentType);
    const safeName = (fileName && typeof fileName === 'string' ? fileName : `upload.${ext}`)
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetFolder = folder && typeof folder === 'string' ? folder : 'images';

    const objectPath = `${userId}/${targetFolder}/${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;

    const storage = getStorageClient();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectPath);

    // Signed URL for a simple PUT upload (short expiry)
    const [uploadUrl] = await file.getSignedUrl({
      action: 'write',
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
      contentType,
    });

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`;

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      objectPath,
      bucketName,
    });
  } catch (error) {
    console.error('Error creating upload URL:', error);
    return NextResponse.json(
      { error: 'Failed to create upload URL', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


