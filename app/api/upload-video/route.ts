import { NextRequest, NextResponse } from 'next/server';
import { uploadVideo } from '@/lib/storage';
import { saveVideo } from '@/lib/firestore';
import { generateVideoId } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoUrl, userId, templateId, templateName, thumbnail } = body;

    if (!videoUrl || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Upload video to GCP Storage
    let finalVideoUrl = videoUrl;
    try {
      finalVideoUrl = await uploadVideo(videoUrl, userId);
    } catch (uploadError) {
      console.error('Error uploading video to GCP:', uploadError);
      // Continue with original URL if upload fails
    }

    // Save video metadata to Firestore
    const videoId = generateVideoId();
    const isWatermarked = false;
    
    await saveVideo({
      videoUrl: finalVideoUrl,
      thumbnail: thumbnail || '',
      templateId: templateId || '',
      templateName: templateName || '',
      createdAt: new Date().toISOString(),
      isWatermarked,
      userId,
    });
    
    return NextResponse.json({
      videoId,
      videoUrl: finalVideoUrl,
      status: 'completed',
    });
  } catch (error) {
    console.error('Upload video error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



