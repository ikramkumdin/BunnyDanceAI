import { NextRequest, NextResponse } from 'next/server';
import { storeCallbackResult } from '@/lib/imageCallbackCache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// This endpoint receives callbacks from Kie.ai when image generation completes
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    console.log('🔔 Received Kie.ai image callback:', JSON.stringify(data, null, 2));

    // Kie.ai callback format (from their docs):
    // {
    //   "taskId": "xxx",
    //   "status": "SUCCESS" or "GENERATE_FAILED",
    //   "result_urls": ["https://..."] or null,
    //   "error": "error message" or null
    // }
    
    const taskId = data.taskId || data.task_id;
    const status = data.status;
    const resultUrls = data.result_urls || data.resultUrls || data.response;
    const error = data.error || data.errorMessage;
    
    console.log('📋 Task ID:', taskId);
    console.log('📋 Status:', status);
    console.log('📋 Result URLs:', resultUrls);

    if (!taskId) {
      console.error('⚠️ No taskId in callback data');
      return NextResponse.json({
        success: false,
        error: 'Missing taskId in callback data'
      }, { status: 200 });
    }

    // Store the callback result in cache
    storeCallbackResult({
      taskId,
      status,
      resultUrls: Array.isArray(resultUrls) ? resultUrls : (resultUrls ? [resultUrls] : undefined),
      error
    });

    console.log('✅ Callback result stored in cache for polling to retrieve');
    
    // Acknowledge receipt to Kie.ai
    return NextResponse.json({
      success: true,
      message: 'Callback received and stored',
      taskId: taskId
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Error processing Kie.ai callback:', error);
    
    // Still return 200 to avoid Kie.ai retrying
    return NextResponse.json({
      success: false,
      error: 'Failed to process callback',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 200 });
  }
}

// Also support GET for testing and retrieving cached results
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');
  
  if (taskId) {
    const { getCallbackResult } = await import('@/lib/imageCallbackCache');
    const result = getCallbackResult(taskId);
    
    if (result) {
      return NextResponse.json({
        message: 'Callback result found in cache',
        result: result
      });
    }
    
    return NextResponse.json({
      message: 'No callback result found for this task ID',
      taskId: taskId
    }, { status: 404 });
  }
  
  // Show cache stats
  const { getCacheStats } = await import('@/lib/imageCallbackCache');
  const stats = getCacheStats();
  
  return NextResponse.json({
    message: 'Kie.ai image callback endpoint is active',
    note: 'This endpoint receives POST requests from Kie.ai when images are ready',
    cacheStats: stats
  });
}

