import { NextRequest, NextResponse } from 'next/server';
import { getSignedUrl } from '@/lib/gcp-storage';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    // Extract path from full URL if provided
    let gcsPath = filePath;
    if (filePath.startsWith('https://storage.googleapis.com/')) {
      const url = new URL(filePath);
      // Remove bucket name from path
      const pathParts = url.pathname.split('/').filter(p => p);
      const bucketName = process.env.GCP_STORAGE_BUCKET || 'voice-app-storage';
      if (pathParts[0] === bucketName) {
        gcsPath = pathParts.slice(1).join('/');
      } else {
        gcsPath = url.pathname.substring(1); // Remove leading /
      }
    }

    const signedUrl = await getSignedUrl(gcsPath, 3600); // 1 hour expiry

    return NextResponse.json({
      url: signedUrl,
    });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed URL', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

