import { NextRequest, NextResponse } from 'next/server';
import { storeCallbackResult } from '@/lib/imageCallbackCache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Manual endpoint to sync image result from Kie.ai dashboard
// Use this when callback doesn't fire or cache is lost
export async function POST(request: NextRequest) {
  try {
    const { taskId, imageUrl, status = 'SUCCESS' } = await request.json();

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      );
    }

    console.log(`🔄 Manually syncing image result for task: ${taskId}`);
    console.log(`🖼️ Image URL: ${imageUrl}`);

    // Store in cache
    storeCallbackResult({
      taskId,
      status,
      resultUrls: Array.isArray(imageUrl) ? imageUrl : [imageUrl]
    });

    console.log('✅ Image result synced to cache');

    return NextResponse.json({
      success: true,
      message: 'Image result synced to cache',
      taskId,
      imageUrl: Array.isArray(imageUrl) ? imageUrl[0] : imageUrl
    });

  } catch (error) {
    console.error('❌ Error syncing image result:', error);
    return NextResponse.json(
      { error: 'Failed to sync image result', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check if result is cached
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json(
      { error: 'taskId is required' },
      { status: 400 }
    );
  }

  const { getCallbackResult } = await import('@/lib/imageCallbackCache');
  const result = getCallbackResult(taskId);

  if (result) {
    return NextResponse.json({
      found: true,
      result: result,
      imageUrl: result.resultUrls && result.resultUrls.length > 0 ? result.resultUrls[0] : null
    });
  }

  return NextResponse.json({
    found: false,
    message: 'Result not in cache. Use POST to sync it manually.',
    taskId: taskId
  });
}


