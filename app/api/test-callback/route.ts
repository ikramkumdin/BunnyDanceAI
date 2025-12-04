import { NextRequest, NextResponse } from 'next/server';
import { uploadVideo } from '@/lib/storage';
import { saveVideo } from '@/lib/firestore';
import { generateVideoId } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Test endpoint to simulate callback - for local testing only
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, templateId, templateName, thumbnail, videoUrl } = body;

    if (!userId || !videoUrl) {
      return NextResponse.json(
        { error: 'userId and videoUrl are required' },
        { status: 400 }
      );
    }

    console.log('Test callback - saving video:', { userId, templateId, videoUrl });

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
    
    console.log('Test callback - video saved:', { videoId, finalVideoUrl });

    return NextResponse.json({
      success: true,
      message: 'Test callback processed',
      videoId,
      videoUrl: finalVideoUrl,
    });
  } catch (error) {
    console.error('Test callback error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



