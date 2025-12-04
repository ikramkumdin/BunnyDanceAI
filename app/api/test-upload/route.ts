import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(request: NextRequest) {
  try {
    // Initialize GCP Storage
    let credentials;
    if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
      credentials = typeof process.env.GCP_SERVICE_ACCOUNT_KEY === 'string'
        ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
        : process.env.GCP_SERVICE_ACCOUNT_KEY;
    }

    const storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID || 'voice-app-d19d8',
      credentials,
    });

    const BUCKET_NAME = process.env.GCP_STORAGE_BUCKET || 'bunnydanceai-storage';
    const bucket = storage.bucket(BUCKET_NAME);

    const filePath = path.join(process.cwd(), 'template.mp4');
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'template.mp4 not found' },
        { status: 404 }
      );
    }

    // Upload to templates folder
    const fileName = `templates/template-${Date.now()}.mp4`;
    const fileRef = bucket.file(fileName);

    const fileBuffer = fs.readFileSync(filePath);

    await fileRef.save(fileBuffer, {
      metadata: {
        contentType: 'video/mp4',
        cacheControl: 'public, max-age=31536000',
      },
      public: true,
    });

    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

