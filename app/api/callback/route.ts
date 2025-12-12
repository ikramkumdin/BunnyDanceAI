import { NextRequest, NextResponse } from 'next/server';
import { uploadVideo } from '@/lib/storage';
import { saveVideo } from '@/lib/firestore';
import { generateVideoId } from '@/lib/utils';
import { storeVideoCallbackResult } from '@/lib/videoCallbackCache';

function tryParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const s = value.trim();
  if (!s) return value;
  if (!(s.startsWith('{') || s.startsWith('['))) return value;
  try {
    return JSON.parse(s);
  } catch {
    return value;
  }
}

function collectHttpUrls(input: unknown, maxDepth = 7): string[] {
  const urls: string[] = [];
  const seen = new Set<unknown>();

  const visit = (node: unknown, depth: number) => {
    if (depth > maxDepth) return;
    if (node === null || node === undefined) return;
    if (seen.has(node)) return;

    if (typeof node === 'string') {
      if (node.startsWith('http://') || node.startsWith('https://')) {
        urls.push(node);
        return;
      }
      const parsed = tryParseJson(node);
      if (parsed !== node) visit(parsed, depth + 1);
      return;
    }

    if (Array.isArray(node)) {
      seen.add(node);
      for (const item of node) visit(item, depth + 1);
      return;
    }

    if (typeof node === 'object') {
      seen.add(node);
      for (const value of Object.values(node as Record<string, unknown>)) {
        visit(value, depth + 1);
      }
    }
  };

  visit(input, 0);
  return urls.filter((u, i) => urls.indexOf(u) === i);
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);

    console.log('🎯 Callback received from Kie.ai!');
    console.log('📦 Callback body:', JSON.stringify(body, null, 2));
    console.log('🔗 Callback query params:', Object.fromEntries(searchParams));
    console.log('🔍 Full request keys:', Object.keys(body));

    // Try to get metadata from various sources
    // Kie.ai might send it in body, or we might need to use a different approach
    let userId = searchParams.get('userId') || body.userId || body.data?.userId;
    let templateId = searchParams.get('templateId') || body.templateId || body.data?.templateId;
    let templateName = searchParams.get('templateName') || body.templateName || body.data?.templateName;
    let thumbnail = searchParams.get('thumbnail') || body.thumbnail || body.data?.thumbnail;

    // If no metadata found, this might be a direct callback from Kie.ai
    // We'll need to handle this differently or skip saving for now
    if (!userId) {
      console.log('⚠️ No userId found in callback - this might be a direct Kie.ai callback');
      console.log('📦 Full callback data:', JSON.stringify(body, null, 2));

      // Still store for polling to retrieve (text-to-video flow uses this)
      const taskId = body.taskId || body.data?.taskId || body.task_id || searchParams.get('taskId') || body.id;

      // Extract video url from common locations or deep scan
      let videoUrl =
        body.videoUrl ||
        body.data?.videoUrl ||
        body.url ||
        body.data?.url ||
        body.video_url ||
        body.data?.video_url ||
        body.result?.videoUrl ||
        body.result?.url ||
        body.output?.videoUrl ||
        body.output?.url ||
        body.data?.response ||
        body.response ||
        body.data?.resultJson ||
        body.resultJson;

      if (typeof videoUrl === 'string') {
        const parsed = tryParseJson(videoUrl) as any;
        // If it was JSON, try to extract
        if (parsed && parsed !== videoUrl) {
          const extracted =
            parsed?.videoUrl ||
            parsed?.url ||
            parsed?.resultUrls?.[0] ||
            parsed?.result_urls?.[0] ||
            parsed?.data?.videoUrl ||
            parsed?.data?.url ||
            parsed?.data?.resultUrls?.[0] ||
            parsed?.data?.result_urls?.[0] ||
            parsed?.data?.response?.resultUrls?.[0] ||
            parsed?.data?.response?.result_urls?.[0];
          videoUrl = extracted ?? videoUrl;
        }
      }

      if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.startsWith('http')) {
        const scanned = collectHttpUrls(body);
        const picked = scanned.find((u) => u.includes('.mp4') || u.includes('video') || u.includes('mp4')) || scanned[0];
        if (picked) videoUrl = picked;
      }

      if (taskId) {
        storeVideoCallbackResult({
          taskId,
          status: (body.status || body.data?.status || body.state || body.data?.state || 'SUCCESS').toString().toUpperCase(),
          videoUrl: typeof videoUrl === 'string' && videoUrl.startsWith('http') ? videoUrl : undefined,
          error: body.error || body.data?.error || body.failMsg || body.data?.failMsg,
        });
      }

      // Acknowledge the callback without saving to Firestore (no userId)
      return NextResponse.json({
        success: true,
        message: 'Callback received but no metadata to process',
      });
    }

    // Handle different callback formats from Kie.ai
    const taskId = body.taskId || body.data?.taskId || body.task_id || searchParams.get('taskId');
    const videoUrl = body.videoUrl || body.data?.videoUrl || body.url || body.data?.url || body.video_url || body.data?.video_url ||
                     body.result?.videoUrl || body.result?.url || body.output?.videoUrl || body.output?.url;

    console.log('🎬 Extracted data:', { userId, templateId, templateName, taskId, videoUrl });
    const status = body.status || body.data?.status;
    
    if (!videoUrl) {
      return NextResponse.json(
        { error: 'No video URL in callback', received: body },
        { status: 400 }
      );
    }

    // Always cache for polling, even if we also save to Firestore
    if (taskId && typeof videoUrl === 'string' && videoUrl.startsWith('http')) {
      storeVideoCallbackResult({
        taskId,
        status: (status || body.state || body.data?.state || 'SUCCESS').toString().toUpperCase(),
        videoUrl,
        error: body.error || body.data?.error || body.failMsg || body.data?.failMsg,
      });
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
          type: 'video',
          tags: ['video'],
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

