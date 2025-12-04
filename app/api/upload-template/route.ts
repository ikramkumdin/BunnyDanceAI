import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slot = 1 } = body; // Allow specifying which custom slot to update (1, 2, or 3)

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

    const BUCKET_NAME = process.env.GCP_STORAGE_BUCKET || 'voice-app-storage';
    const bucket = storage.bucket(BUCKET_NAME);

    // Read the specific video file
    const filePath = path.join(process.cwd(), 'users_9d5c51d1-aae9-4abe-b7cc-4c18e48ee313_generated_3eabe9d7-3698-4409-bf3b-79c47f5d601c_generated_video.mp4');

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Video file not found in project root' },
        { status: 404 }
      );
    }

    // Upload to templates folder with slot-specific name
    const fileName = `templates/custom-dance-slot-${slot}-${Date.now()}.mp4`;
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
      slot: slot,
      message: `Custom template slot ${slot} uploaded successfully`,
    });
  } catch (error) {
    console.error('Error uploading template:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
