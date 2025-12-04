import { NextRequest, NextResponse } from 'next/server';
import { uploadVideo } from '@/lib/storage';
import { saveVideo } from '@/lib/firestore';
import { generateVideoId } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    
    console.log('Callback received:', JSON.stringify(body, null, 2));
    console.log('Callback query params:', Object.fromEntries(searchParams));
    
    // Get metadata from query params (passed in callBackUrl)
    const userId = searchParams.get('userId') || body.userId || body.data?.userId;
    const templateId = searchParams.get('templateId') || body.templateId || body.data?.templateId;
    const templateName = searchParams.get('templateName') || body.templateName || body.data?.templateName;
    const thumbnail = searchParams.get('thumbnail') || body.thumbnail || body.data?.thumbnail;
    
    // Handle different callback formats from Kie.ai
    const taskId = body.taskId || body.data?.taskId || body.task_id || searchParams.get('taskId');
    const videoUrl = body.videoUrl || body.data?.videoUrl || body.url || body.data?.url;
    const status = body.status || body.data?.status;
    
    if (!videoUrl) {
      return NextResponse.json(
        { error: 'No video URL in callback', received: body },
        { status: 400 }
      );
    }
    
    // If we have userId, save the video
    if (userId) {
      try {
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
        
        console.log('Video saved successfully:', { videoId, finalVideoUrl });
      } catch (saveError) {
        console.error('Error saving video:', saveError);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Callback processed',
      taskId,
      videoUrl,
    });
  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Also handle GET requests (some webhooks use GET)
export async function GET(request: NextRequest) {
  return POST(request);
}

